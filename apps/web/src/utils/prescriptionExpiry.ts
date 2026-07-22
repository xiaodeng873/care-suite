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

export async function expireActivePrescriptions(): Promise<number> {
  // 前端主動更新已到期處方：由 PrescriptionManagement 的輪詢呼叫
  // 實際更新會由呼叫端使用 supabase client 完成；此處只提供判斷輔助
  return 0;
}
