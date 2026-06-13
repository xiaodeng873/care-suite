/**
 * 判斷一個日期字串是否已逾期。
 *
 * @param dateStr - ISO 日期字串（date-only 或 datetime），undefined/空字串視為未設定
 * @param today   - 比較基準時間（預設為執行時的當下；可注入以利測試）
 */
export function isOverdue(dateStr: string | undefined, today: Date = new Date()): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < today;
}
