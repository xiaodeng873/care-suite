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
let noTokenWarnCount = 0;
const dbFetch: typeof fetch = (input, init) => {
  const dbToken = localStorage.getItem(DB_TOKEN_KEY);
  if (!dbToken) {
    // [DEBUG-db9a] 登入後仍無 dbToken 的請求 = RLS 以 anon 身份過濾，可能靜默回空
    if (noTokenWarnCount < 5 && typeof input === 'string' && input.includes('/rest/v1/')) {
      noTokenWarnCount++;
      console.warn(`[DEBUG-db9a] 請求無 dbToken（${noTokenWarnCount}/5）: ${input.split('?')[0].split('/rest/v1/')[1]}`);
    }
    return fetch(input, init);
  }
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${dbToken}`);
  // 30 秒逾時：斷網 / stalled connection 會令 fetch 永久掛起，
  // 之前全量載入 hang 死令「進行中」標記永不解除，180 天結果長期被擋 → 小日曆 0 行
  const signal = init?.signal ?? AbortSignal.timeout(30000);
  return fetch(input, { ...init, headers, signal });
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