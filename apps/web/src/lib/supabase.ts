import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey, validateSupabaseConfig } from '../config/supabase.config';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

const validation = validateSupabaseConfig();
if (!validation.valid) {
  console.error('❌ Supabase 配置驗證失敗:', validation.message);
  throw new Error(`Supabase configuration error: ${validation.message}`);
}

console.log('✅ Supabase 配置驗證成功');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false
  }
});