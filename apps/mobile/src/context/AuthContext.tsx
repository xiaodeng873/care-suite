import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { 
  UserRole, 
  UserProfile, 
  Permission,
  PermissionCategory,
  PermissionFeature,
  PermissionAction
} from '@care-suite/shared';

const CUSTOM_TOKEN_KEY = 'custom_auth_token';
const CUSTOM_USER_KEY = 'custom_user_profile';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  customToken: string | null;
  permissions: Permission[];
  loading: boolean;
  displayName: string | null;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  customLogin: (username: string, password: string) => Promise<{ error: string | null }>;
  customLogout: () => Promise<void>;
  hasPermission: (category: PermissionCategory, feature: PermissionFeature, action: PermissionAction) => boolean;
  hasCategoryViewPermission: (category: PermissionCategory) => boolean;
  hasAnyPermission: (requiredPermissions: Array<{ category: PermissionCategory; feature: PermissionFeature; action: PermissionAction }>) => boolean;
  isDeveloper: () => boolean;
  isAdmin: () => boolean;
  canManageUsers: () => boolean;
  isAuthenticated: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customToken, setCustomToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
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
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const AUTH_FUNCTION_URL = `${supabaseUrl}/functions/v1/auth-custom`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey || '',
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

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 檢查 Supabase Auth session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (mounted) {
          if (error) {
            console.warn('Auth session error:', error);
            if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid')) {
              console.log('Clearing invalid session...');
              await supabase.auth.signOut();
            }
          }
          setSession(session);
          setUser(session?.user ?? null);
          
          // 檢查自訂認證
          const storedToken = await AsyncStorage.getItem(CUSTOM_TOKEN_KEY);
          const storedUser = await AsyncStorage.getItem(CUSTOM_USER_KEY);
          
          if (storedToken && storedUser) {
            try {
              const result = await callAuthApi('validate', null, storedToken);
              if (result.success) {
                setCustomToken(storedToken);
                setUserProfile(result.user);
                setPermissions(result.permissions || []);
                setDisplayName(getUserDisplayName(null, result.user));
              } else {
                // Token 無效，清除
                await AsyncStorage.removeItem(CUSTOM_TOKEN_KEY);
                await AsyncStorage.removeItem(CUSTOM_USER_KEY);
              }
            } catch (err) {
              console.error('Token validation error:', err);
              await AsyncStorage.removeItem(CUSTOM_TOKEN_KEY);
              await AsyncStorage.removeItem(CUSTOM_USER_KEY);
            }
          } else if (session?.user) {
            setDisplayName(getUserDisplayName(session.user, null));
          }
          
          setLoading(false);
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
        if (mounted) {
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            console.warn('SignOut during error handling failed:', signOutErr);
          }
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setCustomToken(null);
          setPermissions([]);
          setDisplayName(null);
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user && !userProfile) {
            setDisplayName(getUserDisplayName(session.user, null));
          }
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('SignOut error:', error);
      }
      setSession(null);
      setUser(null);
      setDisplayName(null);
    } catch (err) {
      console.error('SignOut exception:', err);
      setSession(null);
      setUser(null);
      setDisplayName(null);
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
        await AsyncStorage.setItem(CUSTOM_TOKEN_KEY, result.token);
        await AsyncStorage.setItem(CUSTOM_USER_KEY, JSON.stringify(result.user));
        
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
      await AsyncStorage.removeItem(CUSTOM_TOKEN_KEY);
      await AsyncStorage.removeItem(CUSTOM_USER_KEY);
      setDisplayName(null);
    }
  };

  // 權限檢查函數
  const hasPermission = (
    category: PermissionCategory,
    feature: PermissionFeature,
    action: PermissionAction
  ): boolean => {
    // 開發者擁有所有權限
    if (role === 'developer') return true;
    
    // 檢查用戶是否有此權限
    return permissions.some(
      p => p.category === category && 
           p.feature === feature && 
           p.action === action && 
           p.granted
    );
  };

  const hasCategoryViewPermission = (category: PermissionCategory): boolean => {
    if (role === 'developer') return true;
    
    return permissions.some(
      p => p.category === category && 
           p.action === 'view' && 
           p.granted
    );
  };

  const hasAnyPermission = (
    requiredPermissions: Array<{
      category: PermissionCategory;
      feature: PermissionFeature;
      action: PermissionAction;
    }>
  ): boolean => {
    if (role === 'developer') return true;
    
    return requiredPermissions.some(req =>
      hasPermission(req.category, req.feature, req.action)
    );
  };

  // 角色檢查函數
  const isDeveloper = (): boolean => role === 'developer';
  const isAdmin = (): boolean => role === 'admin';
  const canManageUsers = (): boolean => role === 'developer' || role === 'admin';
  const isAuthenticated = (): boolean => !!(user || userProfile);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userProfile,
      customToken,
      permissions,
      loading,
      displayName,
      role,
      signIn,
      signOut,
      customLogin,
      customLogout,
      hasPermission,
      hasCategoryViewPermission,
      hasAnyPermission,
      isDeveloper,
      isAdmin,
      canManageUsers,
      isAuthenticated,
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
