/**
 * Supabase 配置管理
 *
 * 一律從環境變數讀取，此檔案不硬編碼任何憑證。
 * 支援雲端 (https://xxx.supabase.co) 與 LAN 自建 (http://192.168.x.x:8000) 兩種環境。
 */

export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
};

/**
 * 獲取 Supabase URL
 */
export function getSupabaseUrl(): string {
  return SUPABASE_CONFIG.url;
}

/**
 * 獲取 Supabase 匿名金鑰
 */
export function getSupabaseAnonKey(): string {
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
      message: '資料庫配置缺失（請檢查 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）'
    };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
  } catch {
    return {
      valid: false,
      message: '資料庫 URL 格式不正確'
    };
  }

  return {
    valid: true,
    message: '資料庫配置正確'
  };
}
