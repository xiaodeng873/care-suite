import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient, User, Session } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config/supabase.config';
import { supabase as dbClient } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { clearFacilitySettingsCache } from '../utils/facilitySettings';
import type {
  UserProfile,
  UserRole,
  PermissionCategory,
  PermissionAction,
} from '@care-suite/shared';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storageKey: 'care_suite_auth',
  }
});

// Edge Function 基礎 URL
const AUTH_FUNCTION_URL = `${supabaseUrl}/functions/v1/auth-custom`;

// 本地存儲鍵
const CUSTOM_TOKEN_KEY = 'care_suite_custom_token';
const CUSTOM_USER_KEY = 'care_suite_custom_user';
// 資料庫存取 token（RLS 院舍隔離用，由認證服務簽發）
const DB_TOKEN_KEY = 'care_suite_db_token';

const saveDbToken = (dbToken?: string | null) => {
  if (dbToken) {
    localStorage.setItem(DB_TOKEN_KEY, dbToken);
  }
};

const clearDbToken = () => {
  localStorage.removeItem(DB_TOKEN_KEY);
};

// 從 dbToken 解出 facility_id（切換院舍後用來重置整個資料樹的 key）
const parseFacilityIdFromToken = (token?: string | null): number | null => {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.facility_id === 'number' ? payload.facility_id : null;
  } catch {
    return null;
  }
};

/** 用戶權限項目 */
export interface UserPermissionItem {
  category: PermissionCategory;
  feature: string;
  feature_name_zh: string;
  action: PermissionAction;
}

interface AuthContextType {
  // Supabase Auth（開發者用）
  user: User | null;
  session: Session | null;
  
  // 自訂認證（主管/員工用）
  userProfile: UserProfile | null;
  customToken: string | null;
  
  // 共用狀態
  loading: boolean;
  authReady: boolean;
  displayName: string | null;
  role: UserRole | null;
  permissions: UserPermissionItem[];
  
  // Supabase Auth 方法（開發者用）
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;

  // 開發者選院舍（facility_id 為 null = 維運模式，跨院舍）
  fetchFacilities: () => Promise<{ id: number; name: string; is_active: boolean }[]>;
  selectFacility: (facilityId: number | null) => Promise<{ error: any }>;
  createFacility: (name: string) => Promise<{ id: number | null; error: any }>;
  // 開發者院舍管理：中止/恢復登入、刪除（僅空院舍）
  suspendFacility: (facilityId: number) => Promise<{ error: any }>;
  resumeFacility: (facilityId: number) => Promise<{ error: any }>;
  deleteFacility: (facilityId: number) => Promise<{ error: any }>;
  // 當前 dbToken 對應的院舍 id（App 層用佢重掛資料樹）
  dbFacilityId: number | null;
  // dbToken 已簽發並寫入 localStorage（閘門等 RPC 必須等呢個 flag 先好發請求）
  dbTokenReady: boolean;
  // 開發者是否已在本工作階段選定院舍（App 層閘門用）
  devFacilityChosen: boolean;
  
  // 自訂認證方法（主管/員工用）
  customLogin: (username: string, password: string) => Promise<{ error: any }>;
  qrLogin: (qrCodeId: string) => Promise<{ error: any }>;
  customLogout: () => Promise<void>;
  
  // 權限檢查方法
  hasPermission: (category: PermissionCategory, feature: string, action: PermissionAction) => boolean;
  hasAnyPermission: (category: PermissionCategory) => boolean;
  hasCategoryViewPermission: (category: PermissionCategory) => boolean;
  isAuthenticated: () => boolean;
  isDeveloper: () => boolean;
  isAdmin: () => boolean;
  canManageUsers: () => boolean;
  
  // 密碼管理
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: any }>;
  verifyPassword: (password: string) => Promise<{ error: any }>;

  // 驗證其他員工身份（不改變當前登入狀態，用於注射第 2/3 簽署人身份確認）
  verifyStaffIdentity: (username: string, password: string) => Promise<{ user: UserProfile | null; error: any }>;
  
  // 刷新權限
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Supabase Auth 狀態
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  
  // 自訂認證狀態
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customToken, setCustomToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<UserPermissionItem[]>([]);
  
  // 共用狀態
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  // 開發者選院舍閘門：每次工作階段必須選擇一次，不得預設
  const [devFacilityChosen, setDevFacilityChosen] = useState(false);
  // 當前 dbToken 對應的院舍 id；切換時 App 用佢做 key 重掛成棵資料樹，杜絕舊院舍資料殘留
  const [dbFacilityId, setDbFacilityId] = useState<number | null>(() =>
    parseFacilityIdFromToken(localStorage.getItem(DB_TOKEN_KEY))
  );
  const [dbTokenReady, setDbTokenReady] = useState<boolean>(() => !!localStorage.getItem(DB_TOKEN_KEY));

  // 計算角色
  const role: UserRole | null = userProfile?.role || (user ? 'developer' : null);

  // 獲取用戶顯示名稱（包含職位）
  const getUserDisplayName = (user: User | null, profile: UserProfile | null): string | null => {
    if (profile) {
      const baseName = profile.name_zh || profile.name_en || profile.username;
      // 獲取職位
      const position = profile.nursing_position || profile.allied_health_position || 
                      profile.hygiene_position || profile.other_position || profile.department;
      return position ? `${baseName} (${position})` : baseName;
    }
    if (user) {
      return user.user_metadata?.display_name || 
             user.user_metadata?.full_name || 
             user.email || 
             null;
    }
    return null;
  };

  // 從 Edge Function 調用 API
  const callAuthApi = async (action: string, body?: any, token?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    };

    // 對於需要認證的操作，使用提供的 token
    // 對於公開操作（如 login, qr-login），使用 anon key 作為 Bearer token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (action === 'login' || action === 'qr-login') {
      // 公開端點使用 anon key 繞過認證
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
    }

    try {
      const response = await fetch(`${AUTH_FUNCTION_URL}/${action}`, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(response.ok ? text : `伺服器回應 ${response.status}: ${text}`);
      }
    } catch (error) {
      console.error(`Auth API error (${action}):`, error);
      throw error instanceof Error ? error : new Error('無法連線到認證伺服器');
    }
  };

  // 驗證自訂 token
  const validateCustomToken = async (token: string) => {
    try {
      const result = await callAuthApi('validate', null, token);
      if (result.success) {
        setUserProfile(result.user);
        setCustomToken(token);
        setPermissions(result.permissions || []);
        setDisplayName(getUserDisplayName(null, result.user));
        saveDbToken(result.dbToken);
        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));
        setDbTokenReady(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  };

  // 初始化認證
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. 先嘗試恢復自訂認證
        const savedToken = localStorage.getItem(CUSTOM_TOKEN_KEY);
        if (savedToken) {
          const isValid = await validateCustomToken(savedToken);
          if (isValid && mounted) {
            setLoading(false);
            setAuthReady(true);
            return;
          } else {
            // Token 無效，清除
            localStorage.removeItem(CUSTOM_TOKEN_KEY);
            localStorage.removeItem(CUSTOM_USER_KEY);
            clearDbToken();
            setDbFacilityId(null);
            setDbTokenReady(false);
          }
        }

        // 2. 嘗試 Supabase Auth
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth timeout')), 5000)
        );
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        if (mounted) {
          if (error) {
            console.warn('Auth session error:', error);
            // 如果是 refresh token 錯誤，清除本地存儲的 session
            if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
              console.warn('Clearing invalid auth session');
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
            }
          }
          setSession(session);
          setUser(session?.user ?? null);
          
          // 開發者自動獲得所有權限
          if (session?.user) {
            setPermissions([]); // 開發者不需要權限列表，isDeveloper() 會返回 true
          }
          
          setDisplayName(getUserDisplayName(session?.user ?? null, null));
          setLoading(false);
          setAuthReady(true);
        }
      } catch (err) {
        console.warn('Auth initialization error (continuing without session):', err);
        if (mounted) {
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setCustomToken(null);
          setDisplayName(null);
          setPermissions([]);
          setLoading(false);
          setAuthReady(true);
        }
      }
    };

    initAuth();

    // 監聽 Supabase Auth 狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          // 處理 token 刷新失敗的情況
          if (event === 'TOKEN_REFRESHED' && !session) {
            console.warn('Token refresh failed, clearing session');
            setSession(null);
            setUser(null);
            setDisplayName(null);
            setPermissions([]);
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setDisplayName(null);
            setPermissions([]);
          } else {
            setSession(session);
            setUser(session?.user ?? null);
            setDisplayName(getUserDisplayName(session?.user ?? null, userProfile));
          }
          setLoading(false);
          setAuthReady(true);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 定期刷新自訂 token 會話，避免長時間未重新載入頁面而過期
  useEffect(() => {
    if (!customToken) return;

    const refreshSession = async () => {
      try {
        const result = await callAuthApi('validate', null, customToken);
        if (result.success) {
          saveDbToken(result.dbToken);
          setDbFacilityId(parseFacilityIdFromToken(result.dbToken));
          setDbTokenReady(true);
          // 內容有變才更新 state，避免無謂的全域 re-render
          setUserProfile((prev) =>
            JSON.stringify(prev) === JSON.stringify(result.user) ? prev : result.user
          );
          const nextPermissions = result.permissions || [];
          setPermissions((prev) =>
            JSON.stringify(prev) === JSON.stringify(nextPermissions) ? prev : nextPermissions
          );
          return;
        }
        // 伺服器明確判定會話無效才登出
        console.warn('Custom token refresh failed, logging out');
        await customLogout();
      } catch (error) {
        // 網絡錯誤／回應異常屬暫時性，保留會話，待下次間隔再試
        console.warn('Custom token refresh request failed (session kept):', error);
      }
    };

    // 每 15 分鐘刷新一次（validate 會順延會話 24 小時，足以保持登入）
    const interval = setInterval(refreshSession, 15 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [customToken]);

  // 獲取院舍列表（開發者選院舍登入用；走 lib dbClient 以帶上 dbToken）
  // 顯示名稱取院舍設定 facility_settings.facility_name_zh，由 RPC 以 SECURITY DEFINER
  // 讀取（developer 未選院舍 token 的 facility_id claim 為 NULL，直接 join 會被 RLS 擋）
  const fetchFacilities = async (): Promise<{ id: number; name: string; is_active: boolean }[]> => {
    // 偶發 statement timeout / 網絡抖動：重試 3 次，避免列表誤判為空
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await dbClient.rpc('get_facility_directory');
      if (!error) {
        return (data || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          is_active: row.is_active !== false,
        }));
      }
      lastError = error;
      console.error(`Fetch facilities error (attempt ${attempt + 1}):`, error);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    throw lastError ?? new Error('載入院舍列表失敗');
  };

  // 新增院舍（開發者用）：建 facilities + 院舍設定列，回傳新院舍 id
  const createFacility = async (name: string): Promise<{ id: number | null; error: any }> => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { id: null, error: '請輸入院舍名稱' };
    }
    const { data: fac, error: facError } = await dbClient
      .from('facilities')
      .insert({ name: trimmed })
      .select('id')
      .single();
    if (facError || !fac) {
      console.error('Create facility error:', facError);
      return { id: null, error: '新增院舍失敗: ' + (facError?.message || '未知錯誤') };
    }
    const { error: settingsError } = await dbClient
      .from('facility_settings')
      .insert({
        facility_id: fac.id,
        facility_name_zh: trimmed,
        facility_phone: '',
        facility_address_zh: '',
        facility_fax: '',
        auto_roster_principles: {},
      });
    if (settingsError) {
      console.error('Create facility_settings error:', settingsError);
      // 設定列建立失敗不阻斷，名稱仍可用 facilities.name 顯示
    }
    // 開通複製：以 facility 1 為種，複製參考資料（藥物庫、ICP問題庫、收費項目等）給新院舍
    const { error: provisionError } = await dbClient.rpc('provision_facility', {
      p_new_facility_id: fac.id,
    });
    if (provisionError) {
      console.error('Provision facility error:', provisionError);
      return { id: fac.id, error: '院舍已建立，但複製參考資料失敗: ' + (provisionError.message || '未知錯誤') };
    }
    return { id: fac.id, error: null };
  };

  // 中止院舍所有用戶登入：停用院舍 + 作廢所有已簽發 dbToken（auth_epoch+1）+ 清除該院舍用戶的登入 session
  const suspendFacility = async (facilityId: number): Promise<{ error: any }> => {
    try {
      const { data: fac, error: readError } = await dbClient
        .from('facilities')
        .select('id, auth_epoch')
        .eq('id', facilityId)
        .single();
      if (readError || !fac) return { error: '院舍不存在' };

      const { error: updateError } = await dbClient
        .from('facilities')
        .update({ is_active: false, auth_epoch: (fac.auth_epoch ?? 0) + 1 })
        .eq('id', facilityId);
      if (updateError) return { error: '停用院舍失敗: ' + (updateError.message || '未知錯誤') };

      const { data: users } = await dbClient
        .from('user_profiles')
        .select('id')
        .eq('facility_id', facilityId);
      const userIds = (users || []).map((u: any) => u.id);
      if (userIds.length > 0) {
        await dbClient.from('user_sessions').delete().in('user_id', userIds);
      }
      return { error: null };
    } catch (e: any) {
      console.error('Suspend facility error:', e);
      return { error: '停用院舍失敗，請稍後再試' };
    }
  };

  // 恢復院舍登入（用戶需重新登入，舊 dbToken 維持失效）
  const resumeFacility = async (facilityId: number): Promise<{ error: any }> => {
    const { error } = await dbClient
      .from('facilities')
      .update({ is_active: true })
      .eq('id', facilityId);
    if (error) return { error: '恢復院舍失敗: ' + (error.message || '未知錯誤') };
    return { error: null };
  };

  // 刪除院舍：連同該院舍所有用戶及記錄一併刪除（DB 端 delete_facility_cascade 整體執行，失敗自動回滾）
  const deleteFacility = async (facilityId: number): Promise<{ error: any }> => {
    try {
      const { error } = await dbClient.rpc('delete_facility_cascade', {
        p_facility_id: facilityId,
      });
      if (error) return { error: '刪除院舍失敗: ' + (error.message || '未知錯誤') };
      return { error: null };
    } catch (e: any) {
      console.error('Delete facility error:', e);
      return { error: '刪除院舍失敗，請稍後再試' };
    }
  };

  // 開發者選定院舍：重發鎖定該院舍的 dbToken（null = 維運模式）
  const selectFacility = async (facilityId: number | null): Promise<{ error: any }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { error: '登入狀態失效，請重新登入' };
      }
      const result = await callAuthApi('db-token', { facility_id: facilityId }, session.access_token);
      if (result?.success && result.dbToken) {
        saveDbToken(result.dbToken);
        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));
        setDbTokenReady(true);
        // 清掉舊院舍的快取資料與設定，避免切換後仍顯示上一間院舍的數據/名稱
        queryClient.clear();
        clearFacilitySettingsCache();
        setDevFacilityChosen(true);
        return { error: null };
      }
      return { error: result?.error || '切換院舍失敗' };
    } catch (error) {
      console.error('Select facility error:', error);
      return { error: '切換院舍失敗，請稍後再試' };
    }
  };

  // Supabase Auth 登入（開發者用）
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      // 取得資料庫存取 token（RLS 院舍隔離用，開發者角色可跨院舍）
      // 失敗必須明確回報，否則會以匿名身份進入系統（看不到任何資料）
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { error: '無法取得登入憑證，請重新登入' };
        }
        const result = await callAuthApi('db-token', null, session.access_token);
        if (!result?.success || !result.dbToken) {
          console.error('db-token rejected:', result);
          return { error: '無法建立資料庫連線權限，請重試（' + (result?.error || '未知錯誤') + '）' };
        }
        saveDbToken(result.dbToken);
        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));
        setDbTokenReady(true);
      } catch (dbTokenError) {
        console.error('Failed to get db token:', dbTokenError);
        return { error: '無法建立資料庫連線權限，請稍後再試' };
      }
    }
    return { error };
  };

  // Supabase Auth 註冊
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  // Supabase Auth 登出
  const signOut = async () => {
    clearDbToken();
    setDbFacilityId(null);
    setDbTokenReady(false);
    setDevFacilityChosen(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSession(null);
        setUser(null);
        setDisplayName(null);
        return;
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('SignOut error:', error);
      }
      
      setSession(null);
      setUser(null);
      setDisplayName(null);
      setPermissions([]);
    } catch (err) {
      console.error('SignOut exception:', err);
      setSession(null);
      setUser(null);
      setDisplayName(null);
      setPermissions([]);
    }
  };

  // 自訂認證登入（主管/員工用）
  const customLogin = async (username: string, password: string) => {
    try {
      const result = await callAuthApi('login', { username, password });
      
      if (result.success) {
        setUserProfile(result.user);
        setCustomToken(result.token);
        setPermissions(result.permissions || []);
        setDisplayName(getUserDisplayName(null, result.user));
        saveDbToken(result.dbToken);
        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));
        setDbTokenReady(true);
        
        // 保存到本地存儲
        localStorage.setItem(CUSTOM_TOKEN_KEY, result.token);
        localStorage.setItem(CUSTOM_USER_KEY, JSON.stringify(result.user));
        
        return { error: null };
      }
      
      return { error: result.error || '登入失敗' };
    } catch (error) {
      console.error('Custom login error:', error);
      return { error: '登入失敗，請稍後再試' };
    }
  };

  // 二維碼登入
  const qrLogin = async (qrCodeId: string) => {
    try {
      const result = await callAuthApi('qr-login', { qr_code_id: qrCodeId });
      
      if (result.success) {
        setUserProfile(result.user);
        setCustomToken(result.token);
        setPermissions(result.permissions || []);
        setDisplayName(getUserDisplayName(null, result.user));
        saveDbToken(result.dbToken);
        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));
        setDbTokenReady(true);
        
        // 保存到本地存儲
        localStorage.setItem(CUSTOM_TOKEN_KEY, result.token);
        localStorage.setItem(CUSTOM_USER_KEY, JSON.stringify(result.user));
        
        return { error: null };
      }
      
      const errorMsg = result.error || result.message || JSON.stringify(result);
      console.error('QR Login failed:', errorMsg);
      return { error: errorMsg };
    } catch (error: any) {
      console.error('QR login error:', error);
      const errMsg = error?.message || String(error);
      return { error: `二維碼登入失敗: ${errMsg}` };
    }
  };

  // 自訂認證登出
  const customLogout = async () => {
    try {
      if (customToken) {
        await callAuthApi('logout', null, customToken);
      }
    } catch (error) {
      console.error('Custom logout error:', error);
    } finally {
      setUserProfile(null);
      setCustomToken(null);
      setPermissions([]);
      setDisplayName(null);
      setDevFacilityChosen(false);
      localStorage.removeItem(CUSTOM_TOKEN_KEY);
      localStorage.removeItem(CUSTOM_USER_KEY);
      clearDbToken();
      setDbFacilityId(null);
      setDbTokenReady(false);
    }
  };

  // 修改密碼
  const changePassword = async (currentPassword: string, newPassword: string) => {
    // Supabase Auth 用戶（開發者）
    if (user) {
      try {
        // 先驗證現有密碼
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: currentPassword,
        });
        if (verifyError) {
          return { error: '現有密碼不正確' };
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          return { error: error.message || '密碼修改失敗' };
        }
        return { error: null };
      } catch (error) {
        console.error('Change password error:', error);
        return { error: '密碼修改失敗，請稍後再試' };
      }
    }

    // 自訂認證用戶（主管/員工）
    if (!userProfile?.id) {
      return { error: '用戶未登入' };
    }

    try {
      const result = await callAuthApi('change-password', {
        userId: userProfile.id,
        currentPassword,
        newPassword,
      }, customToken || undefined);

      if (result.success) {
        return { error: null };
      }

      return { error: result.error || '密碼修改失敗' };
    } catch (error) {
      console.error('Change password error:', error);
      return { error: '密碼修改失敗，請稍後再試' };
    }
  };

  // 驗證密碼（僅驗證身份，不修改密碼）
  const verifyPassword = async (password: string): Promise<{ error: any }> => {
    // 開發者（Supabase Auth 用戶）
    if (user) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password,
        });
        if (error) return { error: '密碼錯誤' };
        return { error: null };
      } catch {
        return { error: '密碼驗證失敗' };
      }
    }
    // 自訂認證用戶（主管/員工）
    if (userProfile?.id) {
      try {
        const result = await callAuthApi('verify-password', {
          userId: userProfile.id,
          password,
        }, customToken || undefined);
        if (result.success) return { error: null };
        return { error: result.error || '密碼錯誤' };
      } catch {
        return { error: '密碼驗證失敗' };
      }
    }
    return { error: '用戶未登入' };
  };

  // 驗證其他員工身份（不改變當前登入狀態 / localStorage）
  // 用於注射藥物第 2/3 簽署人需「特別登入」確認身份
  const verifyStaffIdentity = async (
    username: string,
    password: string
  ): Promise<{ user: UserProfile | null; error: any }> => {
    try {
      const result = await callAuthApi('login', { username, password });
      if (result.success && result.user) {
        return { user: result.user as UserProfile, error: null };
      }
      return { user: null, error: result.error || '帳號或密碼錯誤' };
    } catch (error) {
      console.error('verifyStaffIdentity error:', error);
      return { user: null, error: '身份驗證失敗，請稍後再試' };
    }
  };

  // 刷新權限
  const refreshPermissions = useCallback(async () => {
    if (customToken) {
      const result = await callAuthApi('validate', null, customToken);
      if (result.success) {
        setPermissions(result.permissions || []);
      }
    }
  }, [customToken]);

  // 權限檢查：是否有特定權限
  const hasPermission = useCallback((
    category: PermissionCategory,
    feature: string,
    action: PermissionAction
  ): boolean => {
    // 開發者擁有所有權限（Supabase auth 或自訂認證 developer）
    if (user || userProfile?.role === 'developer') return true;

    // 檢查權限列表
    return permissions.some(
      p => p.category === category && p.feature === feature && p.action === action
    );
  }, [user, userProfile, permissions]);

  // 權限檢查：是否有類別下任一權限
  const hasAnyPermission = useCallback((category: PermissionCategory): boolean => {
    // 開發者擁有所有權限（Supabase auth 或自訂認證 developer）
    if (user || userProfile?.role === 'developer') return true;

    return permissions.some(p => p.category === category);
  }, [user, userProfile, permissions]);

  // 權限檢查：是否有類別下任一查看權限
  const hasCategoryViewPermission = useCallback((category: PermissionCategory): boolean => {
    // 開發者擁有所有權限（Supabase auth 或自訂認證 developer）
    if (user || userProfile?.role === 'developer') return true;

    return permissions.some(p => p.category === category && p.action === 'view');
  }, [user, userProfile, permissions]);

  // 是否已認證
  const isAuthenticated = useCallback((): boolean => {
    return !!(user || userProfile);
  }, [user, userProfile]);

  // 是否為開發者
  const isDeveloper = useCallback((): boolean => {
    return !!user || userProfile?.role === 'developer';
  }, [user, userProfile]);

  // 是否為主管
  const isAdmin = useCallback((): boolean => {
    return isDeveloper() || userProfile?.role === 'admin';
  }, [userProfile, isDeveloper]);

  // 是否可以管理用戶
  const canManageUsers = useCallback((): boolean => {
    return isAdmin();
  }, [isAdmin]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userProfile,
      customToken,
      loading,
      authReady,
      displayName,
      role,
      permissions,
      signIn,
      signUp,
      signOut,
      fetchFacilities,
      selectFacility,
      createFacility,
      suspendFacility,
      resumeFacility,
      deleteFacility,
      devFacilityChosen,
      dbFacilityId,
      dbTokenReady,
      customLogin,
      qrLogin,
      customLogout,
      hasPermission,
      hasAnyPermission,
      hasCategoryViewPermission,
      isAuthenticated,
      isDeveloper,
      isAdmin,
      canManageUsers,
      changePassword,
      verifyPassword,
      verifyStaffIdentity,
      refreshPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { supabase };