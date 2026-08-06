// =====================================================
// 休息日獲得行產生規則（lazy materialization）
// 對應 user_rest_day_details 表內 is_system=true 的「獲得」明細
// 規則：起始日發放一次整數 DO，之後逢周日發放同樣整數 DO；
//       小數部分累積為 PRD fraction，不自動發放，滿 1.0 才可手動預排。
// =====================================================

/** 系統應發放的一筆休息日（DO）獲得行 */
export interface ExpectedRestDayGrant {
  /** 發放日期（YYYY-MM-DD） */
  record_date: string;
  /** 發放天數（>0，整數 DO） */
  days: number;
}

/** 預期休息日結果：整數 DO 獲得行 + 小數累積總額 */
export interface ExpectedRestDayGrantsResult {
  grants: ExpectedRestDayGrant[];
  /** 從起始日至 today 累積的小數總額（可能 >= 1） */
  totalFraction: number;
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

/** 根據每周工作天數計算每周休息天數 */
export function weeklyRestDays(weeklyWorkDays: number): number {
  return 7 - weeklyWorkDays;
}

/** 拆分每周休息天數為：整數 DO 部份 + 小數 PRD 部份 */
export function splitRestDays(weeklyWorkDays: number): { integerDO: number; fraction: number } {
  const rest = weeklyRestDays(weeklyWorkDays);
  const integerDO = Math.floor(rest);
  const fraction = parseFloat((rest - integerDO).toFixed(1));
  return { integerDO, fraction };
}

/**
 * 計算由起始日至 today 為止，系統應存在的整數 DO 獲得行與小數累積總額。
 *
 * 規則（W = 每周工作天數；R = 7 - W；I = floor(R) 整數 DO；F = R - I 小數 PRD）：
 * - 無 W 或 W <= 0 或 W >= 7 → 空結果
 * - 起始日當日：一筆 days = I（若 I > 0）
 * - 之後每個周日（起始日之後的首個周日起；起始日本身是周日則由下一個周日起）：
 *   一筆 days = I（若 I > 0），同時累積 F 至 totalFraction
 * - 返回 { grants, totalFraction = F × 發放次數 }
 */
export function getExpectedRestDayGrants(
  startDate: string | null | undefined,
  weeklyWorkDays: number | null | undefined,
  today: Date = new Date(),
): ExpectedRestDayGrantsResult {
  if (!startDate || weeklyWorkDays === null || weeklyWorkDays === undefined || weeklyWorkDays <= 0 || weeklyWorkDays > 6) {
    return { grants: [], totalFraction: 0 };
  }
  const { integerDO, fraction } = splitRestDays(weeklyWorkDays);
  if (integerDO <= 0 && fraction <= 0) return { grants: [], totalFraction: 0 };

  const todayStr = formatLocalDate(today);
  if (startDate > todayStr) return { grants: [], totalFraction: 0 };

  const grants: ExpectedRestDayGrant[] = [];
  let count = 0;

  if (integerDO > 0) {
    grants.push({ record_date: startDate, days: integerDO });
  }
  count += 1;

  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const dayOfWeek = start.getDay();
  const daysToSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const cursor = new Date(y, m - 1, d + daysToSunday);

  while (formatLocalDate(cursor) <= todayStr) {
    if (integerDO > 0) {
      grants.push({ record_date: formatLocalDate(cursor), days: integerDO });
    }
    count += 1;
    cursor.setDate(cursor.getDate() + 7);
  }

  // 小數累積：每次發放（包括起始日）都累積一次 F
  const totalFraction = parseFloat((fraction * count).toFixed(1));
  return { grants, totalFraction };
}

/** 統計某月周日數（若 startDate 在該月之後，則回 0） */
export function countSundaysInMonth(year: number, month: number, startDate?: string): number {
  const start = startDate ? new Date(startDate) : new Date(year, month - 1, 1);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const effectiveStart = start > monthStart ? start : monthStart;

  let count = 0;
  const cursor = new Date(effectiveStart);
  while (cursor <= monthEnd) {
    if (cursor.getDay() === 0) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** 預期某月 DO / PRD 額度（假設已過入職期，按整月計算） */
export function getExpectedMonthlyRestDays(
  weeklyWorkDays: number,
  year: number,
  month: number,
  currentFraction: number,
  startDate?: string,
): { doDays: number; prdDays: number; totalFraction: number; leftoverFraction: number } {
  if (!weeklyWorkDays || weeklyWorkDays <= 0 || weeklyWorkDays > 6) {
    return { doDays: 0, prdDays: 0, totalFraction: 0, leftoverFraction: 0 };
  }
  const { integerDO, fraction } = splitRestDays(weeklyWorkDays);
  const sundays = countSundaysInMonth(year, month, startDate);

  const doDays = integerDO * sundays;
  const totalFraction = parseFloat((currentFraction + fraction * sundays).toFixed(1));
  const prdDays = Math.floor(totalFraction);
  const leftoverFraction = parseFloat((totalFraction - prdDays).toFixed(1));

  return { doDays, prdDays, totalFraction, leftoverFraction };
}
