// 處方服藥日排程判斷（統一邏輯）
// ─────────────────────────────────────────────────────────────
// 「間隔天數 / 間隔月數」語意（與處方 Modal 標籤一致）：
//   frequency_value = N 代表「跳過 N 天/月」，即服藥週期 = N + 1。
//   例：間隔天數 = 1（隔日服）→ 週期 2 天 → 服藥日 start, start+2, start+4 …
//       間隔天數 = 2（隔2日服）→ 週期 3 天 → 服藥日 start, start+3, start+6 …
// ─────────────────────────────────────────────────────────────

export interface SchedulablePrescription {
  frequency_type?: string;
  frequency_value?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  specific_weekdays?: number[] | null;
  is_odd_even_day?: 'odd' | 'even' | 'none' | string | null;
}

const toDateOnly = (value: string | Date): Date => {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * 判斷某處方在指定日期是否為「應服藥日」（只計算日曆日，不含時分）。
 * 涵蓋：每日 / 隔X日 / 隔X月 / 逢星期 / 單雙日 / 每小時。
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
      if (!start) return true; // 無開始日則無法推算週期，退化為每日
      const gap = Number(prescription.frequency_value) || 1;
      const period = gap + 1; // 週期 = 間隔 + 1
      const daysDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff % period === 0;
    }

    case 'every_x_months': {
      if (!start) return true;
      const gap = Number(prescription.frequency_value) || 1;
      const period = gap + 1; // 週期 = 間隔 + 1
      const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12
        + (target.getMonth() - start.getMonth());
      return monthsDiff >= 0
        && monthsDiff % period === 0
        && target.getDate() === start.getDate();
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
