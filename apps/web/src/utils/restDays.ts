// =====================================================
// 休息日獲得行產生規則（lazy materialization）
// 對應 user_rest_day_details 表內 is_system=true 的「獲得」明細
// 規則：起始日發放一次「每周休息日」天數，之後逢周日發放同樣天數
// =====================================================

/** 系統應發放的一筆休息日獲得行 */
export interface ExpectedRestDayGrant {
  /** 發放日期（YYYY-MM-DD） */
  record_date: string;
  /** 發放天數（>0，最小單位 0.5） */
  days: number;
}

/** 以本地日期組件格式化為 YYYY-MM-DD（避免 toISOString 的時區偏移） */
function formatDate(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function formatLocalDate(date: Date): string {
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * 計算由起始日至 today 為止，系統應存在的休息日獲得行。
 *
 * 規則（W = 每周休息日天數）：
 * - 無 W 或無 startDate → 空陣列
 * - 起始日當日：一筆 days = W（獲得一次休息天數）
 * - 之後每個周日（startDate 之後的首個周日起，若起始日本身是周日則由下一個周日起）：
 *   一筆 days = W，直至 today 為止
 */
export function getExpectedRestDayGrants(
  startDate: string | null | undefined,
  weeklyRestDays: number | null | undefined,
  today: Date = new Date(),
): ExpectedRestDayGrant[] {
  if (!startDate || !weeklyRestDays || weeklyRestDays <= 0) return [];

  const todayStr = formatLocalDate(today);
  if (startDate > todayStr) return [];

  const rows: ExpectedRestDayGrant[] = [{ record_date: startDate, days: weeklyRestDays }];

  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  // 起始日之後的首個周日（getDay: 0 = 周日；起始日適逢周日則取 7 日後）
  const dayOfWeek = start.getDay();
  const daysToSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const cursor = new Date(y, m - 1, d + daysToSunday);

  while (formatLocalDate(cursor) <= todayStr) {
    rows.push({ record_date: formatLocalDate(cursor), days: weeklyRestDays });
    cursor.setDate(cursor.getDate() + 7);
  }

  return rows;
}
