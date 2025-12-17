/**
 * Supabase 配置管理
 *
 * 此配置文件用於防止 Bolt.new 在發布時自動覆蓋環境變數
 * Bolt.new 會將 .env 中的 Supabase 憑證替換為其內建資料庫
 * 因此我們需要在代碼中硬編碼正確的配置作為 fallback
 */

const BOLT_DATABASE_URL = 'kzuhukvdhnuphuilkdmd';

export const SUPABASE_CONFIG = {
  url: 'https://mzeptzwuqvpjspxgnzkp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk'
};

/**
 * 檢測是否為 Bolt Database URL
 */
function isBoltDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes(BOLT_DATABASE_URL);
}

/**
 * 獲取 Supabase URL
 * 優先級:
 * 1. 環境變數 (如果不是 Bolt Database URL)
 * 2. 硬編碼的正確配置
 */
export function getSupabaseUrl(): string {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;

  if (envUrl && !isBoltDatabaseUrl(envUrl)) {
    return envUrl;
  }

  if (isBoltDatabaseUrl(envUrl)) {
    console.warn(
      '⚠️ 檢測到 Bolt.new 自動注入的資料庫 URL，已自動切換為您的 Supabase 配置'
    );
  }

  return SUPABASE_CONFIG.url;
}

/**
 * 獲取 Supabase 匿名金鑰
 * 優先級:
 * 1. 環境變數 (如果 URL 不是 Bolt Database)
 * 2. 硬編碼的正確配置
 */
export function getSupabaseAnonKey(): string {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envKey && !isBoltDatabaseUrl(envUrl)) {
    return envKey;
  }

  return SUPABASE_CONFIG.anonKey;
}

/**
 * 驗證配置是否正確
 */
export function validateSupabaseConfig(): { valid: boolean; message: string } {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    return {
      valid: false,
      message: 'Supabase 配置缺失'
    };
  }

  if (isBoltDatabaseUrl(url)) {
    return {
      valid: false,
      message: '檢測到 Bolt Database URL，但無法找到正確的 Supabase 配置'
    };
  }

  if (!url.includes('supabase.co')) {
    return {
      valid: false,
      message: 'Supabase URL 格式不正確'
    };
  }

  return {
    valid: true,
    message: 'Supabase 配置正確'
  };
}
