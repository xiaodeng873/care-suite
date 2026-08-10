// =====================================================
// 休息日獲得行產生規則（lazy materialization）
// 對應 user_rest_day_details 表內 is_system=true 的「獲得」明細
// 規則：由受僱日開始計算每周工作天數 W；完成 W 天工作後的翌日發放一次 DO；
//       之後每完成一周工作（W 天工作 + R 天休息）再發放同樣整數 DO；
//       小數部分累積為 PRD fraction，滿 1.0 才可手動預排。
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
 * - 受僱日開始計算，完成 W 天工作後的翌日首次發放 days = I
 * - 之後每完成一周工作（再 W 天工作 + R 天休息）發放一次 days = I（若 I > 0）
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

  const [y, m, d] = startDate.split('-').map(Number);
  const firstGrantOffset = Math.floor(weeklyWorkDays);
  const cursor = new Date(y, m - 1, d + firstGrantOffset);

  while (formatLocalDate(cursor) <= todayStr) {
    if (integerDO > 0) {
      grants.push({ record_date: formatLocalDate(cursor), days: integerDO });
    }
    count += 1;
    cursor.setDate(cursor.getDate() + 7);
  }

  // 小數累積：每次發放都累積一次 F
  const totalFraction = parseFloat((fraction * count).toFixed(1));
  return { grants, totalFraction };
}

/** 統計某月內完成一周工作後發放的次數（首次為受僱日 + floor(W) 天，其後每 7 天一次） */
function countGrantEventsInMonth(
  startDate: string,
  weeklyWorkDays: number,
  year: number,
  month: number,
): number {
  const monthStart = formatDate(year, month, 1);
  const monthEnd = formatDate(year, month, new Date(year, month, 0).getDate());
  if (startDate > monthEnd) return 0;

  const [sy, sm, sd] = startDate.split('-').map(Number);
  const firstGrantOffset = Math.floor(weeklyWorkDays);
  const cursor = new Date(sy, sm - 1, sd + firstGrantOffset);

  let count = 0;
  while (formatLocalDate(cursor) <= monthEnd) {
    if (formatLocalDate(cursor) >= monthStart) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return count;
}

/** 預期某月 DO / PRD 獲得量（只計當月，不累積） */
export function getExpectedMonthlyRestDays(
  weeklyWorkDays: number,
  year: number,
  month: number,
  startDate?: string,
): { doDays: number; prdDays: number; totalFraction: number; leftoverFraction: number } {
  if (!weeklyWorkDays || weeklyWorkDays <= 0 || weeklyWorkDays > 6) {
    return { doDays: 0, prdDays: 0, totalFraction: 0, leftoverFraction: 0 };
  }
  if (!startDate) {
    return { doDays: 0, prdDays: 0, totalFraction: 0, leftoverFraction: 0 };
  }
  const { integerDO, fraction } = splitRestDays(weeklyWorkDays);
  const grantEvents = countGrantEventsInMonth(startDate, weeklyWorkDays, year, month);

  const doDays = integerDO * grantEvents;
  const totalFraction = parseFloat((fraction * grantEvents).toFixed(1));
  const prdDays = Math.floor(totalFraction);
  const leftoverFraction = parseFloat((totalFraction - prdDays).toFixed(1));

  return { doDays, prdDays, totalFraction, leftoverFraction };
}
