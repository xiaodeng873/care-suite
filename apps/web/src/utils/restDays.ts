// =====================================================
// 休息日獲得行產生規則（lazy materialization）
// 對應 user_rest_day_details 表內 is_system=true 的「獲得」明細
// 規則：以自然週為單位，按星期幾發放：
//       - 整數休息日從星期日開始往前分配（1 天 = 1 個星期日，2 天 = 星期六 + 星期日，…）
//       - 小數部分再往前推一天：例如 5.5 天工作休息 1.5 天，星期日發 1 DO，星期六發 0.5 PRD
//       - 月中入職者只計算自入職當日起該月剩餘的合資格星期日 / 星期六
// =====================================================

/** 星期幾：0 = 星期日，1 = 星期一，…，6 = 星期六 */
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 日期加減天數，回傳 YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

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
 * 把每周休息日分配到具體星期幾：
 * - 整數部分從星期日（0）開始往前數
 * - 小數部分再往前一天，作為 PRD fraction 日
 */
function getRestDayDistribution(weeklyWorkDays: number): {
  integerDays: DayOfWeek[];
  fractionDay: DayOfWeek | null;
  fraction: number;
} {
  if (weeklyWorkDays <= 0 || weeklyWorkDays > 6) {
    return { integerDays: [], fractionDay: null, fraction: 0 };
  }

  const { integerDO, fraction } = splitRestDays(weeklyWorkDays);
  const integerDays: DayOfWeek[] = [];
  for (let i = 0; i < integerDO; i++) {
    const day = ((0 - i) % 7 + 7) % 7 as DayOfWeek;
    integerDays.push(day);
  }

  const fractionDay =
    fraction > 0 ? (((0 - integerDO) % 7) + 7) % 7 as DayOfWeek : null;

  return { integerDays, fractionDay, fraction };
}

/** 統計某區間內某個星期幾出現多少次；可指定起始日（包含） */
function countDaysOfWeekInRange(
  dayOfWeek: DayOfWeek,
  startDate: string,
  endDate: string,
): number {
  if (startDate > endDate) return 0;
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  let count = 0;
  const cursor = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cursor <= end) {
    if (cursor.getDay() === dayOfWeek) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * 計算由起始日至 today 為止，系統應存在的整數 DO 獲得行與小數累積總額。
 *
 * 規則：
 * - 無起始日、無 W、W <= 0 或 W >= 7 → 空結果
 * - 起始日在未來 → 空結果
 * - 整數 DO 分配到星期日往前數的各星期；小數 PRD 分配到再往前一天的星期
 * - 自起始日當天起開始計算符合條件的星期日 / 星期六
 */
export function getExpectedRestDayGrants(
  startDate: string | null | undefined,
  weeklyWorkDays: number | null | undefined,
  today: Date = new Date(),
): ExpectedRestDayGrantsResult {
  if (!startDate || weeklyWorkDays === null || weeklyWorkDays === undefined || weeklyWorkDays <= 0 || weeklyWorkDays > 6) {
    return { grants: [], totalFraction: 0 };
  }

  const dist = getRestDayDistribution(weeklyWorkDays);
  if (dist.integerDays.length === 0 && !dist.fractionDay) {
    return { grants: [], totalFraction: 0 };
  }

  const todayStr = formatLocalDate(today);
  if (startDate > todayStr) return { grants: [], totalFraction: 0 };

  const grants: ExpectedRestDayGrant[] = [];
  let totalFraction = 0;

  const [y, m, d] = startDate.split('-').map(Number);
  const cursor = new Date(y, m - 1, d);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  while (formatLocalDate(cursor) <= todayStr) {
    const dayOfWeek = cursor.getDay() as DayOfWeek;
    const dateStr = formatLocalDate(cursor);

    if (dist.integerDays.includes(dayOfWeek)) {
      grants.push({ record_date: dateStr, days: 1 });
    }

    if (dist.fractionDay === dayOfWeek && dist.fraction > 0) {
      totalFraction += dist.fraction;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return { grants, totalFraction: parseFloat(totalFraction.toFixed(1)) };
}

/** 預期某月 DO / PRD 獲得量（只計當月，不累積）
 *  endDate：離職日（當日起不再計算），只計算到 endDate 前一日 */
export function getExpectedMonthlyRestDays(
  weeklyWorkDays: number,
  year: number,
  month: number,
  startDate?: string,
  endDate?: string,
): { doDays: number; prdDays: number; totalFraction: number; leftoverFraction: number } {
  if (!weeklyWorkDays || weeklyWorkDays <= 0 || weeklyWorkDays > 6 || !startDate) {
    return { doDays: 0, prdDays: 0, totalFraction: 0, leftoverFraction: 0 };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = formatDate(year, month, 1);
  const monthEnd = formatDate(year, month, daysInMonth);
  const effectiveStart = startDate > monthStart ? startDate : monthStart;
  const effectiveEnd = endDate && endDate < monthEnd ? addDays(endDate, -1) : monthEnd;

  if (effectiveStart > effectiveEnd) {
    return { doDays: 0, prdDays: 0, totalFraction: 0, leftoverFraction: 0 };
  }

  const dist = getRestDayDistribution(weeklyWorkDays);

  let doDays = 0;
  let totalFraction = 0;

  for (const dayOfWeek of dist.integerDays) {
    doDays += countDaysOfWeekInRange(dayOfWeek, effectiveStart, effectiveEnd);
  }

  if (dist.fractionDay && dist.fraction > 0) {
    const fractionCount = countDaysOfWeekInRange(dist.fractionDay, effectiveStart, effectiveEnd);
    totalFraction = parseFloat((dist.fraction * fractionCount).toFixed(1));
  }

  const prdDays = Math.floor(totalFraction);
  const leftoverFraction = parseFloat((totalFraction - prdDays).toFixed(1));

  return { doDays, prdDays, totalFraction, leftoverFraction };
}
