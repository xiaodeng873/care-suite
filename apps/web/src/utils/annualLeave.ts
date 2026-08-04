// =====================================================
// 有薪年假獲得行產生規則（lazy materialization）
// 對應 user_annual_leave_details 表內 is_system=true 的「獲得」明細
// =====================================================

/** 系統應發放的一筆年假獲得行 */
export interface ExpectedAnnualLeaveGrant {
  /** 發放日期（YYYY-MM-DD） */
  record_date: string;
  /** 發放天數（>0，最小單位 0.5） */
  days: number;
}

/**
 * 四捨五入至最近 0.5。
 * 例：1.75→2.0，1.24→1.0，1.25→1.5（0.25 進位、0.75 進位）
 */
export function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** 以本地日期組件格式化為 YYYY-MM-DD（避免 toISOString 的時區偏移） */
function formatDate(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function parseDate(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

/**
 * 將日期加上 N 個月，回傳「每月受僱日」。
 * 月底處理：若入職日為某月最後幾日而目標月份沒有該日（如 1月31日 加一個月到 2月），
 * 則取目標月份的最後一日（2月28/29日）；下個月仍以原本入職日為基準重新計算，
 * 不會因一次截斷而永久漂移（例如 1月31日 入職，受僱日依次為 2月28日、3月31日、4月30日…）。
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const { y, m, d } = parseDate(dateStr);
  const total = (m - 1) + months;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  // new Date(ny, nm, 0) = nm 月的最後一日（月份為 1-based 的下一個月的第 0 天）
  const lastDay = new Date(ny, nm, 0).getDate();
  return formatDate(ny, nm, Math.min(d, lastDay));
}

/**
 * 計算由入職 / 年假計算起始日至 today 為止，系統應存在的年假獲得行。
 *
 * 規則（Y = 每年年假天數，m = 由 startDate 起計的完整受僱月數，以每月受僱日為界，
 * 例如 6月1日 入職，9月1日 滿 3 個月）：
 * - 無 Y 或無 startDate → 空陣列
 * - m < 3：無獲得
 * - 滿 3 個月：一筆 days = roundHalf(Y×3/12)
 * - 滿 4..11 個月：每月受僱日一筆，days = roundHalf(Y×k/12) − roundHalf(Y×(k−1)/12)，
 *   略過 days=0 的月份（roundHalf 令部分月份增量為 0）
 * - 滿 12 個月（首個週年日）：一筆 days = Y − roundHalf(Y×11/12)，補足首年全年 Y
 * - 其後每個受僱週年日（24、36…個月）：一筆 days = Y
 */
export function getExpectedAnnualLeaveGrants(
  startDate: string | null | undefined,
  daysPerYear: number | null | undefined,
  today: Date = new Date(),
): ExpectedAnnualLeaveGrant[] {
  if (!startDate || !daysPerYear || daysPerYear <= 0) return [];

  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // 受僱月數 m：最大的 k 使第 k 個每月受僱日 <= today（YYYY-MM-DD 可直接字串比較）
  let m = 0;
  while (addMonthsClamped(startDate, m + 1) <= todayStr) m++;

  const rows: ExpectedAnnualLeaveGrant[] = [];
  for (let k = 3; k <= m; k++) {
    let days: number;
    if (k === 3) {
      days = roundHalf((daysPerYear * 3) / 12);
    } else if (k < 12) {
      days = roundHalf((daysPerYear * k) / 12) - roundHalf((daysPerYear * (k - 1)) / 12);
    } else if (k % 12 === 0) {
      days = k === 12 ? daysPerYear - roundHalf((daysPerYear * 11) / 12) : daysPerYear;
    } else {
      // 滿一年後只有週年日才發放
      continue;
    }
    if (days > 0) {
      rows.push({ record_date: addMonthsClamped(startDate, k), days });
    }
  }
  return rows;
}
