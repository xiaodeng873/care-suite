import type { FollowUpAppointment } from '../lib/database';

/** 覆診地點比對前正規化：去所有空白（含全形空格）、全形括號統一為半形 */
export const normalizeFollowUpLocation = (s?: string | null): string =>
  (s ?? '')
    .replace(/[（）]/g, m => (m === '（' ? '(' : ')'))
    .replace(/[\s　]+/g, '');

export interface FollowUpDuplicateKey {
  院友id: number | null;
  覆診日期: string;
  覆診時間: string;
  覆診地點: string;
}

/** 重複定義：院友id + 覆診日期 + 覆診時間 + 覆診地點（正規化後）完全相同；excludeId 用於編輯時排除自己 */
export const isDuplicateFollowUp = (
  existing: FollowUpAppointment[],
  key: FollowUpDuplicateKey,
  excludeId?: string,
): boolean => {
  if (!key.院友id || !key.覆診日期) return false;
  const time = (key.覆診時間 || '').slice(0, 5);
  const loc = normalizeFollowUpLocation(key.覆診地點);
  return existing.some(a => {
    if (excludeId && String(a.覆診id) === String(excludeId)) return false;
    return (
      Number(a.院友id) === Number(key.院友id) &&
      a.覆診日期 === key.覆診日期 &&
      (a.覆診時間 || '').slice(0, 5) === time &&
      normalizeFollowUpLocation(a.覆診地點) === loc
    );
  });
};
