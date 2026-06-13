import { Redirect } from 'expo-router';
import { useSession } from '@/lib/auth/session';

/**
 * Root index: redirect based on auth state.
 * Expo Router renders this before the layout resolves.
 */
export default function Index() {
  const { supabaseUser, userProfile, isLoading } = useSession();

  if (isLoading) return null;

  return (supabaseUser || userProfile)
    ? <Redirect href="/(app)" />
    : <Redirect href="/(auth)/login" />;
}
