// 處方服藥日排程判斷（統一邏輯）
// ─────────────────────────────────────────────────────────────
// 「間隔天數 / 間隔星期數 / 間隔月數」語意（與處方 Modal 標籤一致）：
//   frequency_value = N 代表「跳過 N 天/星期/月」，即服藥週期 = N + 1。
//   例：間隔天數 = 1（隔日服）→ 週期 2 天 → 服藥日 start, start+2, start+4 …
//       間隔天數 = 2（隔2日服）→ 週期 3 天 → 服藥日 start, start+3, start+6 …
//
// 週期錨點（隔X日 / 隔X星期 / 隔X月）：
//   有 last_taken_date 時，目標日 ≥ 上次服用日 → 以上次服用日為錨點（下次 = 錨點 + 週期）；
//   目標日 < 上次服用日（歷史段）→ 沿用 start_date 週期，保持過往記錄不變。
// ─────────────────────────────────────────────────────────────

export interface SchedulablePrescription {
  frequency_type?: string;
  frequency_value?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  last_taken_date?: string | null;
  specific_weekdays?: number[] | null;
  is_odd_even_day?: 'odd' | 'even' | 'none' | string | null;
}

const toDateOnly = (value: string | Date): Date => {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * 間隔型頻率的週期錨點：目標日在上次服用日或之後，以上次服用日重定週期；
 * 否則沿用開始日期。last_taken_date 早於 start_date 視為手入錯誤，忽略。
 */
const pickIntervalAnchor = (
  prescription: SchedulablePrescription,
  start: Date | null,
  target: Date
): Date | null => {
  if (!prescription.last_taken_date) return start;
  const lastTaken = toDateOnly(prescription.last_taken_date);
  if (start && lastTaken < start) return start;
  return target >= lastTaken ? lastTaken : start;
};

/**
 * 判斷某處方在指定日期是否為「應服藥日」（只計算日曆日，不含時分）。
 * 涵蓋：每日 / 隔X日 / 隔X星期 / 隔X月 / 逢星期 / 單雙日 / 每小時。
 */
export function isPrescriptionScheduledOnDate(
  prescription: SchedulablePrescription,
  date: string | Date
): boolean {
  const target = toDateOnly(date);
  const start = prescription.start_date ? toDateOnly(prescription.start_date) : null;
  const end = prescription.end_date ? toDateOnly(prescription.end_date) : null;

  // 邊界：早於開始日或晚於結束日，一律非服藥日
  if (start && target < start) return false;
  if (end && target > end) return false;

  const freqType = prescription.frequency_type || 'daily';

  switch (freqType) {
    case 'daily':
    case 'hourly':
      return true;

    case 'every_x_days': {
      const anchor = pickIntervalAnchor(prescription, start, target);
      if (!anchor) return true; // 無開始日則無法推算週期，退化為每日
      const gap = Number(prescription.frequency_value) || 1;
      const period = gap + 1; // 週期 = 間隔 + 1
      const daysDiff = Math.floor((target.getTime() - anchor.getTime()) / DAY_MS);
      return daysDiff >= 0 && daysDiff % period === 0;
    }

    case 'every_x_weeks': {
      const anchor = pickIntervalAnchor(prescription, start, target);
      if (!anchor) return true;
      const gap = Number(prescription.frequency_value) || 1;
      const periodDays = (gap + 1) * 7; // 週期 = (間隔星期數 + 1) × 7 天
      const daysDiff = Math.floor((target.getTime() - anchor.getTime()) / DAY_MS);
      return daysDiff >= 0 && daysDiff % periodDays === 0;
    }

    case 'every_x_months': {
      const anchor = pickIntervalAnchor(prescription, start, target);
      if (!anchor) return true;
      const gap = Number(prescription.frequency_value) || 1;
      const period = gap + 1; // 週期 = 間隔 + 1
      const monthsDiff = (target.getFullYear() - anchor.getFullYear()) * 12
        + (target.getMonth() - anchor.getMonth());
      return monthsDiff >= 0
        && monthsDiff % period === 0
        && target.getDate() === anchor.getDate();
    }

    case 'weekly_days': {
      const dow = target.getDay(); // 0=週日 … 6=週六
      const dbDow = dow === 0 ? 7 : dow; // 轉為 1(週一)…7(週日)
      return prescription.specific_weekdays?.includes(dbDow) || false;
    }

    case 'odd_even_days': {
      const n = target.getDate();
      if (prescription.is_odd_even_day === 'odd') return n % 2 === 1;
      if (prescription.is_odd_even_day === 'even') return n % 2 === 0;
      return false;
    }

    default:
      return true;
  }
}

/**
 * 由上次服用日期推算下次服用日期（僅間隔型頻率：隔X日 / 隔X星期 / 隔X月）。
 * 回傳 ISO 日期字串（YYYY-MM-DD）；非間隔型或缺資料時回傳 ''。
 */
export function computeNextDoseFromLastTaken(
  frequencyType: string | undefined,
  frequencyValue: number | null | undefined,
  lastTakenDate: string | null | undefined
): string {
  if (!lastTakenDate) return '';
  const gap = Number(frequencyValue) || 1;
  const anchor = toDateOnly(lastTakenDate);
  const fmt = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (frequencyType) {
    case 'every_x_days': {
      const next = new Date(anchor);
      next.setDate(next.getDate() + (gap + 1));
      return fmt(next);
    }
    case 'every_x_weeks': {
      const next = new Date(anchor);
      next.setDate(next.getDate() + (gap + 1) * 7);
      return fmt(next);
    }
    case 'every_x_months': {
      const next = new Date(anchor);
      next.setMonth(next.getMonth() + (gap + 1));
      return fmt(next);
    }
    default:
      return '';
  }
}
