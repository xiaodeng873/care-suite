// =====================================================
// 自訂用戶認證 Edge Function
// Custom User Authentication with bcrypt
// =====================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey",
};

// 從環境變數獲取 Supabase 配置
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// 專案 JWT secret，用於簽發帶 facility_id claim 的資料庫存取 token
const jwtSecret = Deno.env.get("JWT_SECRET") ?? "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
if (!jwtSecret) {
  console.error("Missing JWT_SECRET (db token will not be issued)");
}

// =====================================================
// 資料庫存取 JWT（HS256）
// PostgREST 會以專案 JWT secret 驗證，RLS 由 facility_id / user_role claim 判斷
// =====================================================

function base64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSign(message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

// 簽發資料庫存取 token；exp 為 epoch 秒，epoch 為院舍登入權杖版號（中止登入後舊 token 失效）
async function signDbToken(
  user: { id: string; facility_id: number | null; role: string },
  expiresAt: Date,
  facilityEpoch: number = 0
): Promise<string | null> {
  if (!jwtSecret) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      aud: "authenticated",
      iss: "supabase",
      role: "authenticated",
      sub: user.id,
      user_id: user.id,
      facility_id: user.facility_id ?? null,
      user_role: user.role,
      epoch: facilityEpoch,
      iat: now,
      exp: Math.floor(expiresAt.getTime() / 1000),
    })
  );
  const signature = base64url(await hmacSign(`${header}.${payload}`, jwtSecret));
  return `${header}.${payload}.${signature}`;
}

// 查院舍登入權杖版號（無院舍 / 找不到 = 0）
async function getFacilityEpoch(supabase: any, facilityId: number | null): Promise<number> {
  if (facilityId == null) return 0;
  const { data } = await supabase
    .from("facilities")
    .select("auth_epoch")
    .eq("id", facilityId)
    .single();
  return data?.auth_epoch ?? 0;
}

// 院舍是否可登入（不存在或已停用 = false）
async function isFacilityActive(supabase: any, facilityId: number | null): Promise<boolean> {
  if (facilityId == null) return true;
  const { data } = await supabase
    .from("facilities")
    .select("is_active")
    .eq("id", facilityId)
    .single();
  return data?.is_active === true;
}

// Session 有效期（10 年，近似永不過期）
const SESSION_EXPIRY_HOURS = 24 * 365 * 10;

interface LoginRequest {
  username: string;
  password: string;
}

interface ChangePasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
  adminToken: string;
}

interface CreateUserRequest {
  username: string;
  password: string;
  name_zh: string;
  name_en?: string;
  id_number?: string;
  date_of_birth?: string;
  department: string;
  nursing_position?: string;
  allied_health_position?: string;
  hygiene_position?: string;
  other_position?: string;
  secondary_positions?: string[];
  hire_date: string;
  employment_type: string;
  monthly_hour_limit?: number;
  role: string;
  created_by?: string;
  facility_id?: number | null;
}

interface QRLoginRequest {
  qr_code_id: string;
}

interface RegenerateQRCodeRequest {
  userId: string;
}

// 生成隨機 token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// 創建 Supabase 客戶端
function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// 處理登入請求
async function handleLogin(req: LoginRequest) {
  const supabase = getSupabaseClient();
  const { username, password } = req;

  console.log("Login attempt for username:", username);

  if (!username || !password) {
    console.log("Missing credentials");
    return {
      success: false,
      error: "帳號和密碼為必填欄位",
    };
  }

  // 查找用戶
  const { data: user, error: userError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("username", username)
    .eq("is_active", true)
    .single();

  if (userError || !user) {
    console.log("User not found or error:", userError);
    return {
      success: false,
      error: "帳號或密碼錯誤",
    };
  }

  // 離職日當日起帳戶自動停用（香港時區）
  const hkToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  if (user.resignation_date && user.resignation_date <= hkToday) {
    await supabase
      .from("user_profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    console.log("Account auto-disabled on resignation date:", user.username);
    return {
      success: false,
      error: "帳號已停用",
    };
  }

  console.log("User found, comparing password...");

  // 驗證密碼
  const isValidPassword = bcrypt.compareSync(password, user.password_hash);
  if (!isValidPassword) {
    console.log("Invalid password");
    return {
      success: false,
      error: "帳號或密碼錯誤",
    };
  }

  // 院舍已停用（中止登入）時拒絕
  if (!(await isFacilityActive(supabase, user.facility_id))) {
    return { success: false, error: "院舍已停用，請聯絡系統管理員" };
  }

  console.log("Password valid, creating session...");

  // 生成 session token
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

  // 儲存 session
  const { error: sessionError } = await supabase.from("user_sessions").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  });

  if (sessionError) {
    console.error("Session creation error:", sessionError);
    return {
      success: false,
      error: "無法建立登入會話",
    };
  }

  // 獲取用戶權限
  const { data: permissions } = await supabase.rpc("get_user_permissions", {
    p_user_id: user.id,
  });

  // 返回用戶資料（不含密碼）
  const { password_hash, ...userWithoutPassword } = user;

  // 簽發資料庫存取 token（RLS tenant 隔離用）
  const dbToken = await signDbToken(user, expiresAt, await getFacilityEpoch(supabase, user.facility_id));

  return {
    success: true,
    user: userWithoutPassword,
    token,
    dbToken,
    expiresAt: expiresAt.toISOString(),
    permissions: permissions || [],
  };
}

// 處理二維碼登入請求
async function handleQRLogin(req: QRLoginRequest) {
  const supabase = getSupabaseClient();
  const { qr_code_id } = req;

  console.log("QR Login attempt with code:", qr_code_id?.substring(0, 8) + "...");

  if (!qr_code_id) {
    console.log("Missing QR code ID");
    return {
      success: false,
      error: "二維碼無效",
    };
  }

  // 根據二維碼 ID 查找用戶
  const { data: user, error: userError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("login_qr_code_id", qr_code_id)
    .eq("is_active", true)
    .single();

  if (userError || !user) {
    console.log("User not found or error:", userError);
    return {
      success: false,
      error: "二維碼無效或帳號已停用",
    };
  }

  // 離職日當日起帳戶自動停用（香港時區）
  const hkToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  if (user.resignation_date && user.resignation_date <= hkToday) {
    await supabase
      .from("user_profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    console.log("Account auto-disabled on resignation date:", user.username);
    return {
      success: false,
      error: "帳號已停用",
    };
  }

  console.log("User found via QR code, creating session...");

  // 院舍已停用（中止登入）時拒絕
  if (!(await isFacilityActive(supabase, user.facility_id))) {
    return { success: false, error: "院舍已停用，請聯絡系統管理員" };
  }


  // 生成 session token
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

  // 儲存 session
  const { error: sessionError } = await supabase.from("user_sessions").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  });

  if (sessionError) {
    console.error("Session creation error:", sessionError);
    return {
      success: false,
      error: "無法建立登入會話",
    };
  }

  // 獲取用戶權限
  const { data: permissions } = await supabase.rpc("get_user_permissions", {
    p_user_id: user.id,
  });

  // 返回用戶資料（不含密碼）
  const { password_hash, ...userWithoutPassword } = user;

  // 簽發資料庫存取 token（RLS tenant 隔離用）
  const dbToken = await signDbToken(user, expiresAt, await getFacilityEpoch(supabase, user.facility_id));

  return {
    success: true,
    user: userWithoutPassword,
    token,
    dbToken,
    expiresAt: expiresAt.toISOString(),
    permissions: permissions || [],
  };
}

// 處理重新生成二維碼請求
async function handleRegenerateQRCode(req: RegenerateQRCodeRequest, authHeader: string) {
  const supabase = getSupabaseClient();
  const { userId } = req;

  if (!userId) {
    return {
      success: false,
      error: "用戶 ID 為必填",
    };
  }

  // 驗證操作者權限
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return {
      success: false,
      error: "未授權",
    };
  }

  // 嘗試從 custom session 驗證
  let operatorRole: string | null = null;

  const { data: session } = await supabase
    .from("user_sessions")
    .select("*, user_profiles(*)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (session) {
    operatorRole = session.user_profiles.role;
  } else {
    // 可能是 Supabase Auth 用戶（開發者）
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("auth_user_id", user.id)
        .single();
      
      operatorRole = profile?.role || "developer";
    }
  }

  // 只有管理者和開發者可以重新生成二維碼
  if (!operatorRole || !["developer", "admin"].includes(operatorRole)) {
    return {
      success: false,
      error: "無權限執行此操作",
    };
  }

  // 生成新的二維碼 ID
  const newQRCodeId = crypto.randomUUID();

  // 更新用戶的二維碼 ID
  const { data: updatedUser, error: updateError } = await supabase
    .from("user_profiles")
    .update({ login_qr_code_id: newQRCodeId })
    .eq("id", userId)
    .select()
    .single();

  if (updateError) {
    console.error("Update QR code error:", updateError);
    return {
      success: false,
      error: "重新生成二維碼失敗",
    };
  }

  const { password_hash, ...userWithoutPassword } = updatedUser;

  return {
    success: true,
    user: userWithoutPassword,
    message: "二維碼已重新生成",
  };
}

// 處理登出請求
async function handleLogout(token: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("user_sessions")
    .delete()
    .eq("token", token);

  if (error) {
    return {
      success: false,
      error: "登出失敗",
    };
  }

  return {
    success: true,
    message: "已成功登出",
  };
}

// 簽發資料庫存取 token（自訂 session token 或 Supabase Auth JWT 皆可）
// developer 可透過 facility_id 參數鎖定某一院舍（選院舍登入）；其他用戶一律用本人院舍
async function handleDbToken(authHeader: string, req: { facility_id?: number | null } = {}) {
  const supabase = getSupabaseClient();
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return { success: false, error: "未授權" };
  }

  // 1. 嘗試自訂 session token
  const { data: session } = await supabase
    .from("user_sessions")
    .select("*, user_profiles(*)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  let profile: { id: string; facility_id: number | null; role: string } | null = null;

  if (session?.user_profiles) {
    profile = session.user_profiles;
  } else {
    // 2. 嘗試 Supabase Auth JWT（開發者）
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      const { data: p } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();
      // 無對應 profile 的 Auth 用戶視為開發者（與 create-user 邏輯一致）
      profile = p ?? { id: user.id, facility_id: null, role: "developer" };
    }
  }

  if (!profile) {
    return { success: false, error: "會話無效或已過期" };
  }

  // developer 可用 facility_id 參數鎖定院舍（選院舍登入）；其他用戶一律用本人院舍
  let facilityId: number | null = profile.facility_id ?? null;
  if (profile.role === "developer") {
    if (req.facility_id != null) {
      const { data: fac } = await supabase
        .from("facilities")
        .select("id")
        .eq("id", req.facility_id)
        .single();
      if (!fac) {
        return { success: false, error: "院舍不存在" };
      }
      facilityId = req.facility_id;
    } else {
      facilityId = null; // 未指定 = 維運模式（跨院舍）
    }
  }

  // 選定的院舍已停用時拒絕簽發
  if (facilityId != null && !(await isFacilityActive(supabase, facilityId))) {
    return { success: false, error: "院舍已停用，請聯絡系統管理員" };
  }

  // 與現有 session 有效期一致：10 年
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);
  const dbToken = await signDbToken(
    { ...profile, facility_id: facilityId },
    expiresAt,
    await getFacilityEpoch(supabase, facilityId)
  );

  if (!dbToken) {
    return { success: false, error: "無法簽發資料庫存取 token" };
  }

  return { success: true, dbToken, expiresAt: expiresAt.toISOString() };
}

// 驗證 session token
async function handleValidateSession(token: string) {
  const supabase = getSupabaseClient();

  // 查找有效的 session
  const { data: session, error: sessionError } = await supabase
    .from("user_sessions")
    .select("*, user_profiles(*)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (sessionError || !session) {
    return {
      success: false,
      error: "會話無效或已過期",
    };
  }

  // 院舍已停用（中止登入）時拒絕
  if (!(await isFacilityActive(supabase, session.user_profiles?.facility_id))) {
    return { success: false, error: "院舍已停用，請聯絡系統管理員" };
  }

  // 每次驗證時自動延長 24 小時，避免使用者因長時間未重新載入頁面而被登出
  const newExpiry = new Date();
  newExpiry.setHours(newExpiry.getHours() + SESSION_EXPIRY_HOURS);
  await supabase
    .from("user_sessions")
    .update({
      expires_at: newExpiry.toISOString(),
      last_accessed_at: new Date().toISOString()
    })
    .eq("id", session.id);

  // 獲取用戶權限
  const { data: permissions } = await supabase.rpc("get_user_permissions", {
    p_user_id: session.user_id,
  });

  const { password_hash, ...userWithoutPassword } = session.user_profiles;

  // 會話已順延，重新簽發資料庫存取 token
  const dbToken = await signDbToken(
    session.user_profiles,
    newExpiry,
    await getFacilityEpoch(supabase, session.user_profiles?.facility_id)
  );

  return {
    success: true,
    user: userWithoutPassword,
    dbToken,
    permissions: permissions || [],
  };
}

// 處理密碼驗證請求（僅驗證，不修改）
async function handleVerifyPassword(req: { userId: string; password: string }) {
  const supabase = getSupabaseClient();
  const { userId, password } = req;

  if (!userId || !password) {
    return {
      success: false,
      error: "所有欄位為必填",
    };
  }

  // 獲取用戶
  const { data: user, error: userError } = await supabase
    .from("user_profiles")
    .select("id, password_hash")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return {
      success: false,
      error: "用戶不存在",
    };
  }

  // 驗證密碼
  const isValidPassword = bcrypt.compareSync(password, user.password_hash);
  if (!isValidPassword) {
    return {
      success: false,
      error: "密碼錯誤",
    };
  }

  return {
    success: true,
    message: "密碼驗證成功",
  };
}

// 處理修改密碼請求
async function handleChangePassword(req: ChangePasswordRequest) {
  const supabase = getSupabaseClient();
  const { userId, currentPassword, newPassword } = req;

  if (!userId || !currentPassword || !newPassword) {
    return {
      success: false,
      error: "所有欄位為必填",
    };
  }

  if (newPassword.length < 6) {
    return {
      success: false,
      error: "新密碼長度至少需要 6 個字元",
    };
  }

  // 獲取用戶
  const { data: user, error: userError } = await supabase
    .from("user_profiles")
    .select("id, password_hash")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return {
      success: false,
      error: "用戶不存在",
    };
  }

  // 驗證當前密碼
  const isValidPassword = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!isValidPassword) {
    return {
      success: false,
      error: "當前密碼錯誤",
    };
  }

  // 加密新密碼並更新
  try {
    const newPasswordHash = bcrypt.hashSync(newPassword);
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ password_hash: newPasswordHash })
      .eq("id", userId);

    if (updateError) {
      return {
        success: false,
        error: "密碼更新失敗",
      };
    }

    return {
      success: true,
      message: "密碼已成功更新",
    };
  } catch (hashError) {
    console.error("bcrypt hash error:", hashError);
    return {
      success: false,
      error: "密碼加密失敗",
    };
  }
}

// 處理重設密碼請求（管理者/開發者用）
async function handleResetPassword(req: ResetPasswordRequest, authHeader: string) {
  const supabase = getSupabaseClient();
  const { userId, newPassword } = req;

  if (!userId || !newPassword) {
    return {
      success: false,
      error: "用戶 ID 和新密碼為必填",
    };
  }

  if (newPassword.length < 6) {
    return {
      success: false,
      error: "新密碼長度至少需要 6 個字元",
    };
  }

  // 驗證管理者權限（從 Authorization header 獲取 token）
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return {
      success: false,
      error: "未授權",
    };
  }

  // 嘗試從 custom session 驗證
  let operatorRole: string | null = null;

  const { data: session } = await supabase
    .from("user_sessions")
    .select("*, user_profiles(*)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (session) {
    operatorRole = session.user_profiles.role;
  } else {
    // 可能是 Supabase Auth 用戶（開發者）
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("auth_user_id", user.id)
        .single();
      
      operatorRole = profile?.role || "developer";
    }
  }

  if (!operatorRole || !["developer", "admin"].includes(operatorRole)) {
    return {
      success: false,
      error: "無權限執行此操作",
    };
  }

  // 加密新密碼並更新
  try {
    const newPasswordHash = bcrypt.hashSync(newPassword);
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ password_hash: newPasswordHash })
      .eq("id", userId);

    if (updateError) {
      return {
        success: false,
        error: "密碼重設失敗",
      };
    }

    return {
      success: true,
      message: "密碼已成功重設",
    };
  } catch (hashError) {
    console.error("bcrypt hash error:", hashError);
    return {
      success: false,
      error: "密碼加密失敗",
    };
  }
}

// 創建新用戶
async function handleCreateUser(req: CreateUserRequest, authHeader: string) {
  const supabase = getSupabaseClient();

  // 驗證必填欄位
  if (!req.username || !req.password || !req.name_zh || !req.department || !req.hire_date || !req.employment_type || !req.role) {
    return {
      success: false,
      error: "缺少必填欄位",
    };
  }

  if (req.password.length < 6) {
    return {
      success: false,
      error: "密碼長度至少需要 6 個字元",
    };
  }

  // 驗證操作者權限
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return {
      success: false,
      error: "未授權",
    };
  }

  // 嘗試從 custom session 驗證
  let operatorRole: string | null = null;
  let operatorUserId: string | null = null;

  const { data: session } = await supabase
    .from("user_sessions")
    .select("*, user_profiles(*)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (session) {
    // 自訂認證用戶
    operatorRole = session.user_profiles.role;
    operatorUserId = session.user_id;
    // 非開發者管理員只能在自己院舍開戶
    if (operatorRole !== "developer") {
      req.facility_id = session.user_profiles.facility_id;
    }
  } else {
    // 可能是 Supabase Auth 用戶（開發者），嘗試驗證 JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (user) {
      // 檢查是否有對應的 user_profile（開發者）
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, id")
        .eq("auth_user_id", user.id)
        .single();
      
      if (profile) {
        operatorRole = profile.role;
        operatorUserId = profile.id;
      } else {
        // Supabase Auth 用戶默認為開發者，但沒有 user_profile
        operatorRole = "developer";
        operatorUserId = null; // 設為 null 避免外鍵約束錯誤
      }
    }
  }

  if (!operatorRole || !["developer", "admin"].includes(operatorRole)) {
    return {
      success: false,
      error: "無權限創建用戶",
    };
  }

  // 管理者不能創建開發者或其他管理者
  if (operatorRole === "admin" && ["developer", "admin"].includes(req.role)) {
    return {
      success: false,
      error: "管理者只能創建員工帳號",
    };
  }

  // 檢查用戶名是否已存在
  const { data: existingUser } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("username", req.username)
    .single();

  if (existingUser) {
    return {
      success: false,
      error: "用戶名已存在",
    };
  }

  // 加密密碼
  let passwordHash: string;
  try {
    passwordHash = bcrypt.hashSync(req.password);
  } catch (hashError) {
    console.error("bcrypt hash error:", hashError);
    return {
      success: false,
      error: "密碼加密失敗",
    };
  }

  // 創建用戶
  const { data: newUser, error: createError } = await supabase
    .from("user_profiles")
    .insert({
      username: req.username,
      password_hash: passwordHash,
      name_zh: req.name_zh,
      name_en: req.name_en || null,
      id_number: req.id_number || null,
      date_of_birth: req.date_of_birth || null,
      department: req.department,
      nursing_position: req.nursing_position || null,
      allied_health_position: req.allied_health_position || null,
      hygiene_position: req.hygiene_position || null,
      other_position: req.other_position || null,
      secondary_positions: req.secondary_positions || [],
      hire_date: req.hire_date,
      employment_type: req.employment_type,
      monthly_hour_limit: req.employment_type === "兼職" ? (req.monthly_hour_limit || 68) : null,
      role: req.role,
      created_by: operatorUserId,
      facility_id: req.facility_id ?? null,
    })
    .select()
    .single();

  if (createError) {
    console.error("Create user error:", createError);
    return {
      success: false,
      error: "創建用戶失敗: " + createError.message,
    };
  }

  const { password_hash, ...userWithoutPassword } = newUser;

  return {
    success: true,
    user: userWithoutPassword,
    message: "用戶已成功創建",
  };
}

// 主處理函數
Deno.serve(async (req: Request) => {
  // 處理 CORS 預檢請求
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();
    const authHeader = req.headers.get("Authorization") || "";

    let result;

    switch (action) {
      case "login": {
        const body = await req.json();
        result = await handleLogin(body);
        break;
      }
      case "logout": {
        const token = authHeader.replace("Bearer ", "");
        result = await handleLogout(token);
        break;
      }
      case "validate": {
        const token = authHeader.replace("Bearer ", "");
        result = await handleValidateSession(token);
        break;
      }
      case "db-token": {
        const body = await req.json().catch(() => ({}));
        result = await handleDbToken(authHeader, body);
        break;
      }
      case "change-password": {
        const body = await req.json();
        result = await handleChangePassword(body);
        break;
      }
      case "verify-password": {
        const body = await req.json();
        result = await handleVerifyPassword(body);
        break;
      }
      case "reset-password": {
        const body = await req.json();
        result = await handleResetPassword(body, authHeader);
        break;
      }
      case "create-user": {
        const body = await req.json();
        result = await handleCreateUser(body, authHeader);
        break;
      }
      case "qr-login": {
        const body = await req.json();
        result = await handleQRLogin(body);
        break;
      }
      case "regenerate-qr-code": {
        const body = await req.json();
        result = await handleRegenerateQRCode(body, authHeader);
        break;
      }
      default:
        result = {
          success: false,
          error: `未知的操作: ${action}`,
        };
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Auth error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "內部伺服器錯誤",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
