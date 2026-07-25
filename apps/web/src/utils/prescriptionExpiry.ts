// 處方到期/即將到期判斷（香港時區）

export interface ExpirablePrescription {
  status?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string | null;
  end_time?: string | null;
  is_long_term?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function getHongKongNow(): Date {
  // 取得香港時區（UTC+8）的現在時間
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

export function formatHongKongDateTime(d = getHongKongNow()): { date: string; time: string } {
  const iso = d.toISOString();
  const [date, time] = iso.split('T');
  return { date, time: time.substring(0, 8) }; // HH:MM:SS
}

export function formatHongKongDate(d = getHongKongNow()): string {
  return formatHongKongDateTime(d).date;
}

export function formatHongKongTime(d = getHongKongNow()): string {
  return formatHongKongDateTime(d).time.substring(0, 5); // HH:MM
}

export function normalizeTime(time?: string | null): string {
  if (!time) return '00:00';
  return time.substring(0, 5);
}

export function isPrescriptionExpired(prescription: ExpirablePrescription, now: Date = getHongKongNow()): boolean {
  if (prescription.status !== 'active') return false;
  if (!prescription.end_date) return false;

  const endTime = normalizeTime(prescription.end_time);
  // 把 end_date/end_time 當作香港時間，並以 UTC 形式建構 Date，
  // 與 getHongKongNow()（UTC+8 偏移）進行一致比較。
  const end = new Date(`${prescription.end_date}T${endTime}:00.000Z`);
  return now >= end;
}

export function isPrescriptionAboutToExpire(prescription: ExpirablePrescription, now: Date = getHongKongNow()): boolean {
  if (prescription.status !== 'active') return false;
  if (!prescription.end_date) return false;
  if (isPrescriptionExpired(prescription, now)) return false;

  const endTime = normalizeTime(prescription.end_time);
  const end = new Date(`${prescription.end_date}T${endTime}:00.000Z`);
  return now < end;
}

export function getExpiryDateTime(prescription: ExpirablePrescription): string | null {
  if (!prescription.end_date) return null;
  const endTime = normalizeTime(prescription.end_time);
  return `${prescription.end_date}T${endTime}:00`;
}

/**
 * 判斷處方在指定排程日期/時間是否仍有效。
 * 適用於 active 與 inactive 處方：只要排程時點落在 [start_date/start_time, end_date/end_time] 內即有效。
 * inactive 處方若沒有 end_date，無法判斷停服時間點，視為無效。
 */
export function isPrescriptionValidAt(
  prescription: ExpirablePrescription,
  scheduledDate: string,
  scheduledTime?: string | null
): boolean {
  // inactive 且無結束日期：無法判斷有效期，視為無效
  if (prescription.status !== 'active' && !prescription.end_date) return false;

  const startDate = prescription.start_date;
  const endDate = prescription.end_date;

  // 早於開始日
  if (startDate && scheduledDate < startDate) return false;
  // 晚於結束日
  if (endDate && scheduledDate > endDate) return false;

  const targetTime = normalizeTime(scheduledTime);

  // 開始日當天：時間點必須 >= start_time
  if (startDate && scheduledDate === startDate) {
    const startTime = normalizeTime(prescription.start_time);
    if (targetTime < startTime) return false;
  }

  // 結束日當天：時間點必須 <= end_time
  if (endDate && scheduledDate === endDate) {
    const endTime = normalizeTime(prescription.end_time);
    if (targetTime > endTime) return false;
  }

  return true;
}

/**
 * 判斷處方有效期是否與指定日期區間有重疊（日期層級，用於週視圖過濾）。
 * 不檢查具體時間點，只檢查 start_date/end_date 是否與 [rangeStart, rangeEnd] 相交。
 */
export function prescriptionOverlapsDateRange(
  prescription: ExpirablePrescription,
  rangeStart: string,
  rangeEnd: string
): boolean {
  // inactive 且無結束日期：無法判斷，視為無效
  if (prescription.status !== 'active' && !prescription.end_date) return false;

  const startDate = prescription.start_date;
  const endDate = prescription.end_date;

  // 處方結束日早於區間開始日：無重疊
  if (endDate && endDate < rangeStart) return false;
  // 處方開始日晚於區間結束日：無重疊
  if (startDate && startDate > rangeEnd) return false;

  return true;
}

export async function expireActivePrescriptions(): Promise<number> {
  // 前端主動更新已到期處方：由 PrescriptionManagement 的輪詢呼叫
  // 實際更新會由呼叫端使用 supabase client 完成；此處只提供判斷輔助
  return 0;
}
