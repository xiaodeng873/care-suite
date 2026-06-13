import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoredCustomUser, getStoredCustomToken } from './auth';
import type { UserProfile } from '@shared/user-management';

export interface Session {
  /** Supabase Auth user (Developer role) or null */
  supabaseUser: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] | null;
  /** Staff/Admin profile from custom auth */
  userProfile: UserProfile | null;
  /** Raw custom JWT (needed for API calls) */
  customToken: string | null;
  isLoading: boolean;
}

/**
 * Returns the current auth session, whichever auth path was used.
 * Components read from this hook — they do not talk to Supabase directly.
 */
export function useSession(): Session {
  const [supabaseUser, setSupabaseUser] = useState<Session['supabaseUser']>(null);
  const [userProfile,  setUserProfile]  = useState<UserProfile | null>(null);
  const [customToken,  setCustomToken]  = useState<string | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Check Supabase session
      const { data } = await supabase.auth.getSession();
      const sbUser = data.session?.user ?? null;

      // Check custom session
      const [profile, token] = await Promise.all([
        getStoredCustomUser(),
        getStoredCustomToken(),
      ]);

      if (!cancelled) {
        setSupabaseUser(sbUser);
        setUserProfile(profile);
        setCustomToken(token);
        setIsLoading(false);
      }
    }

    load();

    // Keep Supabase session in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!cancelled) setSupabaseUser(s?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { supabaseUser, userProfile, customToken, isLoading };
}

/**
 * Convenience: is any session active?
 */
export function useIsAuthenticated() {
  const { supabaseUser, userProfile, isLoading } = useSession();
  return { isAuthenticated: !!(supabaseUser || userProfile), isLoading };
}
