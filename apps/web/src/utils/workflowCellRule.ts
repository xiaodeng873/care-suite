// eMAR 同藥紙 html 共用嘅格仔顯示規則（單一真相來源）
//
// 業務規則（2026-09 同用戶確認）：
// 1. 已簽記錄（任一步驟非 pending）= 歷史，永不刪除；
//    但顯示上只限處方「開始日期–結束日期」範圍內——範圍外一律灰格隱藏（表面睇唔到）
// 2. 時間點可以隨時改；舊時間點只要喺範圍內嘅當週（eMAR）/ 當月（藥紙）有記錄，
//    該時間列照樣出現
// 3. 純 pending 記錄 = 排程預告，可以被清理（見 edge function）

import { isPrescriptionValidAt, type ExpirablePrescription } from './prescriptionExpiry';

/** 工作流程記錄最少需要嘅欄位（eMAR 同 exporter 共用呢個形狀就夠） */
export interface WorkflowCellRecord {
  scheduled_date: string;
  scheduled_time?: string | null;
  preparation_status?: string | null;
  verification_status?: string | null;
  dispensing_status?: string | null;
}

/** 時間點標準化為 HH:MM（DB 可能含秒） */
export const normalizeSlotKey = (time?: string | null): string =>
  (time ?? '').substring(0, 5);

/** 記錄係咪「已簽」：任何一個步驟唔係 pending（completed / failed 都算歷史） */
export const recordHasSignature = (record: WorkflowCellRecord): boolean =>
  [record.preparation_status, record.verification_status, record.dispensing_status]
    .some((s) => s !== undefined && s !== null && s !== 'pending');

/**
 * 格仔日期（+時間）係咪喺處方有效期內。
 * 兩邊統一用 isPrescriptionValidAt：範圍外 → 灰格隱藏（包括已簽記錄）。
 */
export const isCellDateInRange = (
  prescription: ExpirablePrescription,
  date: string,
  time?: string | null,
): boolean => isPrescriptionValidAt(prescription, date, time);

const slotToMinutes = (slot: string): number => {
  const m = slot.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : Number.MAX_SAFE_INTEGER;
};

/**
 * 計算要顯示嘅時間列：當前處方時間點 ∪ 範圍內 [from, to] 有記錄嘅（舊）時間點。
 * - currentSlots：處方而家嘅 medication_time_slots（已 resolve）
 * - records：當週（eMAR）或當月（藥紙）嘅 workflow records
 * - 只收 HH:MM 格式時間點；範圍外日期嘅記錄唔會令舊時間點復活
 * 回傳按時間先後排序嘅去重清單。
 */
export const mergeRecordSlots = (
  prescription: ExpirablePrescription,
  currentSlots: string[],
  records: WorkflowCellRecord[],
  from: string,
  to: string,
): string[] => {
  const slots = new Set(
    currentSlots.map(normalizeSlotKey).filter((s) => /^\d{1,2}:\d{2}$/.test(s)),
  );
  for (const record of records) {
    const slot = normalizeSlotKey(record.scheduled_time);
    if (!/^\d{1,2}:\d{2}$/.test(slot)) continue;
    if (record.scheduled_date < from || record.scheduled_date > to) continue;
    // 範圍外嘅記錄唔顯示，所以唔應該令時間列出現
    if (!isCellDateInRange(prescription, record.scheduled_date, slot)) continue;
    slots.add(slot);
  }
  return [...slots].sort((a, b) => slotToMinutes(a) - slotToMinutes(b));
};
