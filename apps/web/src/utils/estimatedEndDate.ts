// 預計結束日期推算：藥物數量 ÷ 每日平均用量，起算日 = 處方日期
// 僅在沒有明確 end_date 時計算（專門處理長期藥物）。

export interface EstimatablePrescription {
  prescription_date?: string;
  end_date?: string | null;
  medication_quantity?: string | number | null;
  dosage_amount?: string | number | null;
  daily_frequency?: number | null;
  medication_time_slots?: string[] | null;
  frequency_type?: string | null;
  frequency_value?: number | null;
  specific_weekdays?: number[] | null;
  is_odd_even_day?: string | null;
}

const toNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return NaN;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : NaN;
};

// 依頻率類型換算「每日平均用量」
export function computeDailyAverageUsage(rx: EstimatablePrescription): number {
  const dosage = toNumber(rx.dosage_amount);
  if (!Number.isFinite(dosage) || dosage <= 0) return NaN;

  const dailyFreq = rx.daily_frequency
    || (Array.isArray(rx.medication_time_slots) ? rx.medication_time_slots.length : 0)
    || 1;

  const freqType = rx.frequency_type || 'daily';
  const freqValue = Number(rx.frequency_value) || 1;

  switch (freqType) {
    case 'daily':
      return dosage * dailyFreq;
    case 'every_x_days':
      return (dosage * dailyFreq) / (freqValue > 0 ? freqValue : 1);
    case 'odd_even_days':
      return (dosage * dailyFreq) / 2;
    case 'weekly_days': {
      const n = Array.isArray(rx.specific_weekdays) ? rx.specific_weekdays.length : 0;
      if (n <= 0) return NaN;
      return (dosage * dailyFreq * n) / 7;
    }
    case 'every_x_months':
      return (dosage * dailyFreq) / ((freqValue > 0 ? freqValue : 1) * 30);
    case 'hourly':
      return dosage * (24 / (freqValue > 0 ? freqValue : 24));
    default:
      return dosage * dailyFreq;
  }
}

// 回傳 ISO 日期字串（YYYY-MM-DD）或 ''（無法推算 / 已有明確結束日期）
export function computeEstimatedEndDate(rx: EstimatablePrescription): string {
  if (rx.end_date) return '';            // 有明確結束日期則不推算
  if (!rx.prescription_date) return '';

  const quantity = toNumber(rx.medication_quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return '';

  const perDay = computeDailyAverageUsage(rx);
  if (!Number.isFinite(perDay) || perDay <= 0) return '';

  const days = Math.floor(quantity / perDay);
  if (days <= 0) return '';

  const base = new Date(`${rx.prescription_date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + days);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

// 今天到某日期的剩餘天數（可為負）
export function daysUntil(dateIso: string, today: Date = new Date()): number {
  const target = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return NaN;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((t1.getTime() - t0.getTime()) / (24 * 60 * 60 * 1000));
}
