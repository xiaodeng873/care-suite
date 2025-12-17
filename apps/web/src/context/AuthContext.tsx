import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient, User, Session } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config/supabase.config';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false
  }
});

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  displayName: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // 獲取用戶顯示名稱
  const getUserDisplayName = (user: User | null): string | null => {
    if (!user) return null;
    
    // 優先順序：user_metadata.display_name > user_metadata.full_name > email
    return user.user_metadata?.display_name || 
           user.user_metadata?.full_name || 
           user.email || 
           null;
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
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
          setDisplayName(getUserDisplayName(session?.user ?? null));
          setLoading(false);
          setAuthReady(true);
        }
      } catch (err) {
        console.warn('Auth initialization error (continuing without session):', err);
        if (mounted) {
          setSession(null);
          setUser(null);
          setDisplayName(null);
          setLoading(false);
          setAuthReady(true);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          console.log('Auth state changed:', event, session?.user?.email);
          setSession(session);
          setUser(session?.user ?? null);
          setDisplayName(getUserDisplayName(session?.user ?? null));
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    console.log('SignOut function called'); // Debug log
    try {
      // Check if we have a valid session before attempting to sign out
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No active session found, clearing local state');
        // If no session exists, just clear the local state
        setSession(null);
        setUser(null);
        setDisplayName(null);
        return;
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('SignOut error:', error);
        // Even if signOut fails, clear local state
        setSession(null);
        setUser(null);
        setDisplayName(null);
      } else {
        console.log('SignOut successful');
      }
    } catch (err) {
      console.error('SignOut exception:', err);
      // Clear local state even if there's an exception
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
      authReady,
      displayName,
      signIn,
      signUp,
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

export { supabase };