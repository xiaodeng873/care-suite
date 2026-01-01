import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient, User, Session } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config/supabase.config';
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
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Edge Function 基礎 URL
const AUTH_FUNCTION_URL = `${supabaseUrl}/functions/v1/auth-custom`;

// 本地存儲鍵
const CUSTOM_TOKEN_KEY = 'care_suite_custom_token';
const CUSTOM_USER_KEY = 'care_suite_custom_user';

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
  
  // 自訂認證（管理者/員工用）
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
  
  // 自訂認證方法（管理者/員工用）
  customLogin: (username: string, password: string) => Promise<{ error: any }>;
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
    // 對於公開操作（如 login），使用 anon key 作為 Bearer token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (action === 'login') {
      // login 端點使用 anon key 繞過認證
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
    }
    
    const response = await fetch(`${AUTH_FUNCTION_URL}/${action}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    return response.json();
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
          setSession(session);
          setUser(session?.user ?? null);
          setDisplayName(getUserDisplayName(session?.user ?? null, userProfile));
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

  // Supabase Auth 登入（開發者用）
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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

  // 自訂認證登入（管理者/員工用）
  const customLogin = async (username: string, password: string) => {
    try {
      const result = await callAuthApi('login', { username, password });
      
      if (result.success) {
        setUserProfile(result.user);
        setCustomToken(result.token);
        setPermissions(result.permissions || []);
        setDisplayName(getUserDisplayName(null, result.user));
        
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
      localStorage.removeItem(CUSTOM_TOKEN_KEY);
      localStorage.removeItem(CUSTOM_USER_KEY);
    }
  };

  // 修改密碼
  const changePassword = async (currentPassword: string, newPassword: string) => {
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
    // 開發者擁有所有權限
    if (user) return true;
    
    // 檢查權限列表
    return permissions.some(
      p => p.category === category && p.feature === feature && p.action === action
    );
  }, [user, permissions]);

  // 權限檢查：是否有類別下任一權限
  const hasAnyPermission = useCallback((category: PermissionCategory): boolean => {
    // 開發者擁有所有權限
    if (user) return true;
    
    return permissions.some(p => p.category === category);
  }, [user, permissions]);

  // 權限檢查：是否有類別下任一查看權限
  const hasCategoryViewPermission = useCallback((category: PermissionCategory): boolean => {
    // 開發者擁有所有權限
    if (user) return true;
    
    return permissions.some(p => p.category === category && p.action === 'view');
  }, [user, permissions]);

  // 是否已認證
  const isAuthenticated = useCallback((): boolean => {
    return !!(user || userProfile);
  }, [user, userProfile]);

  // 是否為開發者
  const isDeveloper = useCallback((): boolean => {
    return !!user || userProfile?.role === 'developer';
  }, [user, userProfile]);

  // 是否為管理者
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
      customLogin,
      customLogout,
      hasPermission,
      hasAnyPermission,
      hasCategoryViewPermission,
      isAuthenticated,
      isDeveloper,
      isAdmin,
      canManageUsers,
      changePassword,
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