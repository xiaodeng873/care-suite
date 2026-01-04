import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey, validateSupabaseConfig } from '../config/supabase.config';
const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const validation = validateSupabaseConfig();
if (!validation.valid) {
  console.error('❌ Supabase 配置驗證失敗:', validation.message);
  throw new Error(`Supabase configuration error: ${validation.message}`);
}

// 檢查是否使用自訂認證（不是 Supabase Auth）
const isUsingCustomAuth = () => {
  return !!localStorage.getItem('care_suite_custom_token');
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    // 當使用自訂認證時，不要持久化 Supabase session，避免干擾
    persistSession: false,
    detectSessionInUrl: false,
    // 不要嘗試從本地存儲恢復 session
    storageKey: 'care_suite_supabase_auth',
  },
  global: {
    headers: {
      // 確保使用 anon key 進行請求
      'apikey': supabaseAnonKey,
    },
  },
});