import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey, validateSupabaseConfig } from '../config/supabase.config';
const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const validation = validateSupabaseConfig();
if (!validation.valid) {
  console.error('❌ 資料庫配置驗證失敗:', validation.message);
  throw new Error(`Supabase configuration error: ${validation.message}`);
}

// 檢查是否使用自訂認證（不是 Supabase Auth）
const isUsingCustomAuth = () => {
  return !!localStorage.getItem('care_suite_custom_token');
};

// 資料庫存取 token（登入時由認證服務簽發，RLS 據此做院舍隔離）
const DB_TOKEN_KEY = 'care_suite_db_token';

// 每次請求時動態注入 Authorization，確保使用最新的 db token
const dbFetch: typeof fetch = (input, init) => {
  const dbToken = localStorage.getItem(DB_TOKEN_KEY);
  if (!dbToken) {
    return fetch(input, init);
  }
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${dbToken}`);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    // 當使用自訂認證時，不要持久化 Supabase session，避免干擾
    persistSession: false,
    detectSessionInUrl: false,
    // 不要嘗試從本地存儲恢復 session
    storageKey: 'care_suite_auth',
  },
  global: {
    fetch: dbFetch,
    headers: {
      // 確保使用 anon key 進行請求
      'apikey': supabaseAnonKey,
    },
  },
});