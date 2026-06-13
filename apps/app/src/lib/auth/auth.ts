import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CUSTOM_TOKEN_KEY = 'care_suite_custom_token';
const CUSTOM_USER_KEY  = 'care_suite_custom_user';

// ---------------------------------------------------------------------------
// Storage helpers (SecureStore on native, localStorage on web)
// ---------------------------------------------------------------------------
async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  return SecureStore.setItemAsync(key, value);
}
async function storageDel(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  return SecureStore.deleteItemAsync(key);
}

// ---------------------------------------------------------------------------
// Supabase Email auth (Developer role)
// ---------------------------------------------------------------------------
export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  await supabase.auth.signOut();
  await storageDel(CUSTOM_TOKEN_KEY);
  await storageDel(CUSTOM_USER_KEY);
}

// ---------------------------------------------------------------------------
// Custom auth (Staff / Admin via username)
// ---------------------------------------------------------------------------
export async function customLogin(username: string, password: string) {
  const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(`${supabaseUrl}/functions/v1/auth-custom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ action: 'login', username, password }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    return { error: data.error ?? '登入失敗' };
  }

  await storageSet(CUSTOM_TOKEN_KEY, data.token);
  await storageSet(CUSTOM_USER_KEY,  JSON.stringify(data.user));

  return { error: null, user: data.user, token: data.token };
}

export async function getStoredCustomUser() {
  const raw = await storageGet(CUSTOM_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function getStoredCustomToken() {
  return storageGet(CUSTOM_TOKEN_KEY);
}
