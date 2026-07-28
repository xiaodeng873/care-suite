// =====================================================
// WhatsApp 一鍵開啟工具
// 適用於 apps/web，使用 WhatsApp Web/App 通用 URL scheme
// =====================================================

/**
 * 移除電話號碼中的空格、橫線、括號等非數字/+字符，
 * 並統一補上 +852 國際前綴。
 *
 * 規則：
 * - 已以 + 開頭：保留原樣
 * - 以 852 開頭但無 +：補上 +
 * - 否則補上 +852
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';

  // 先移除非數字與非 + 的字符（空格、橫線、括號等）
  const cleaned = phone.replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  if (cleaned.startsWith('852')) {
    return `+${cleaned}`;
  }

  return `+852${cleaned}`;
}

/**
 * 組合 WhatsApp Web 開啟 URL。
 * 使用 https://wa.me/{phone}?text={message}，可在桌面/網頁版預填文字。
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';

  const baseUrl = `https://wa.me/${normalized.replace('+', '')}`;
  if (message && message.trim()) {
    return `${baseUrl}?text=${encodeURIComponent(message.trim())}`;
  }
  return baseUrl;
}

/**
 * 開啟 WhatsApp 對話框。
 * 桌面環境會打開 WhatsApp Web 並預填文字；不會自動送出訊息。
 */
export function openWhatsApp(phone: string, message?: string): void {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) {
    console.warn('無法開啟 WhatsApp：電話號碼無效');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function isWhatsAppAvailable(phone?: string): boolean {
  if (!phone) return false;
  return normalizePhoneNumber(phone).length > 3;
}
