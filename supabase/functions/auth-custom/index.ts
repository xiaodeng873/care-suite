// =====================================================
// 自訂用戶認證 Edge Function
// Custom User Authentication with bcrypt
// =====================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import bcrypt from "npm:bcryptjs@2.4.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey",
};

// 從環境變數獲取 Supabase 配置
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Session 有效期（24 小時）
const SESSION_EXPIRY_HOURS = 24;

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
  hire_date: string;
  employment_type: string;
  monthly_hour_limit?: number;
  role: string;
  created_by?: string;
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

  return {
    success: true,
    user: userWithoutPassword,
    token,
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

  console.log("User found via QR code, creating session...");

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

  return {
    success: true,
    user: userWithoutPassword,
    token,
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

  // 更新最後訪問時間
  await supabase
    .from("user_sessions")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", session.id);

  // 獲取用戶權限
  const { data: permissions } = await supabase.rpc("get_user_permissions", {
    p_user_id: session.user_id,
  });

  const { password_hash, ...userWithoutPassword } = session.user_profiles;

  return {
    success: true,
    user: userWithoutPassword,
    permissions: permissions || [],
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
  const newPasswordHash = bcrypt.hashSync(newPassword, 10);
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
  const newPasswordHash = bcrypt.hashSync(newPassword, 10);
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
  const passwordHash = bcrypt.hashSync(req.password, 10);

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
      hire_date: req.hire_date,
      employment_type: req.employment_type,
      monthly_hour_limit: req.employment_type === "兼職" ? (req.monthly_hour_limit || 68) : null,
      role: req.role,
      created_by: operatorUserId,
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
      case "change-password": {
        const body = await req.json();
        result = await handleChangePassword(body);
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
