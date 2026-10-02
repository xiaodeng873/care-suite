// 處方開始/結束時間智能預填
// 開始時間：以「而家」對服用時間點，取最接近的下次服用時間點
// 結束時間：推算最後一次服用的時間點（優先服用日數 → 結束日期 → 每日次數/時間點）

const normalizeSlot = (slot: unknown): string | null => {
  if (typeof slot !== 'string') return null;
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const normalizeHHMM = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const toISODate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * 最接近的下次服用時間點：
 * 今日尚未過的最早時間點；全部已過則取最早時間點（即聽日第一次）。
 */
export function nextDoseTime(nowHHMM: string, slots: (string | null | undefined)[] | null | undefined): string | null {
  const now = normalizeHHMM(nowHHMM);
  const normalized = (slots || [])
    .map(normalizeSlot)
    .filter((s): s is string => s !== null)
    .sort();
  if (!now || normalized.length === 0) return null;

  const upcoming = normalized.find(s => s >= now);
  return upcoming ?? normalized[0];
}

export interface LastDoseInput {
  startDate?: string | null;      // YYYY-MM-DD
  startTime?: string | null;      // HH:MM
  slots?: (string | null | undefined)[] | null;
  dailyFrequency?: number | null;
  durationDays?: string | number | null;
  endDate?: string | null;        // YYYY-MM-DD
}

export interface LastDoseDateTime {
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
}

/**
 * 最後一次服用日期時間：
 * 1. 最後服用日：服用日數（開始日 + 日數 - 1）優先；否則用結束日期
 * 2. 開始日當日由開始時間起計（只計 >= 開始時間的時間點）
 * 3. 最後服用時間點 = 最後服用日內最早嘅時間點（例如 29/9 20:00 首服、
 *    每日 8A/8P、服用 4 日 → 最後日 2/10，時間點取 08:00）
 */
export function lastDoseDateTime(input: LastDoseInput): LastDoseDateTime | null {
  const slots = (input.slots || [])
    .map(normalizeSlot)
    .filter((s): s is string => s !== null)
    .sort();
  if (slots.length === 0) return null;

  // 1. 最後服用日
  let finalDate: string | null = null;
  const days = parseInt(String(input.durationDays ?? ''), 10);
  const startDate = input.startDate && /^\d{4}-\d{2}-\d{2}/.test(input.startDate) ? input.startDate : null;
  if (Number.isFinite(days) && days > 0 && startDate) {
    const d = new Date(`${startDate}T00:00:00`);
    d.setDate(d.getDate() + days - 1);
    finalDate = toISODate(d);
  } else if (input.endDate && /^\d{4}-\d{2}-\d{2}/.test(input.endDate)) {
    finalDate = input.endDate;
  }
  if (!finalDate) return null;

  // 2. 最後一日即開始日時，由開始時間起計
  const startTime = normalizeHHMM(input.startTime);
  let candidates = slots;
  if (startDate && finalDate === startDate && startTime) {
    const filtered = slots.filter(s => s >= startTime);
    candidates = filtered.length > 0 ? filtered : slots;
  }

  // 3. 取最後服用日內最早嘅時間點
  return { date: finalDate, time: candidates[0] };
}
