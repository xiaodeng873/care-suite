// 入住類型變更到期套用：揀選邏輯（純函數，方便測試）
// database.tsx 嘅 applyDueStayTypeChanges 用呢個函數揀出要套用嘅記錄

export interface StayTypeChangeLike {
  id: string;
  patient_id: number;
  event_type: string;
  event_date: string; // YYYY-MM-DD
  applied: boolean;
  created_at?: string;
}

/**
 * 由 log 清單揀出「到期要套用」嘅類型變更：
 * - 只睇 event_type='類型變更'、applied=false、event_date <= todayStr
 * - 同一院友有多筆到期 → 只取 event_date 最新一筆（同日則取 created_at 最新）
 * 回傳每個院友最多一筆。
 */
export const pickDueStayTypeChanges = <T extends StayTypeChangeLike>(
  logs: T[],
  todayStr: string
): T[] => {
  const latestByPatient = new Map<number, T>();
  for (const log of logs) {
    if (log.event_type !== '類型變更') continue;
    if (log.applied) continue;
    if (log.event_date > todayStr) continue;
    const existing = latestByPatient.get(log.patient_id);
    if (
      !existing ||
      log.event_date > existing.event_date ||
      (log.event_date === existing.event_date && (log.created_at ?? '') > (existing.created_at ?? ''))
    ) {
      latestByPatient.set(log.patient_id, log);
    }
  }
  return [...latestByPatient.values()];
};
