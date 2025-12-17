import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const getUserDisplayName = (user: User | null): string | null => {
    if (!user) return null;
    return user.user_metadata?.display_name ||
           user.user_metadata?.full_name ||
           user.email ||
           null;
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (mounted) {
          if (error) {
            console.warn('Auth session error:', error);
            // 如果 refresh token 无效，清除会话
            if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid')) {
              console.log('Clearing invalid session...');
              await supabase.auth.signOut();
            }
          }
          setSession(session);
          setUser(session?.user ?? null);
          setDisplayName(getUserDisplayName(session?.user ?? null));
          setLoading(false);
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
        if (mounted) {
          // 清除无效的认证状态
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            console.warn('SignOut during error handling failed:', signOutErr);
          }
          setSession(null);
          setUser(null);
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
          setDisplayName(getUserDisplayName(session?.user ?? null));
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

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      displayName,
      signIn,
      signOut
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
