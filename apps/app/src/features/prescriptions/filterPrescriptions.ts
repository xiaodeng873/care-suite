import type { MedicationPrescription, PrescriptionStatusType } from './usePrescriptions';
import type { Resident } from '@/features/residents/types';

/**
 * 依狀態與文字查詢過濾處方清單。
 *
 * @param prescriptions - 完整處方清單
 * @param residents     - 院友清單（用於跨實體搜尋姓名 / 床號）
 * @param query         - 文字查詢（空白視為無過濾）
 * @param status        - 狀態過濾（'all' 不過濾）
 */
export function filterPrescriptions(
  prescriptions: MedicationPrescription[],
  residents: Resident[],
  query: string,
  status: PrescriptionStatusType | 'all'
): MedicationPrescription[] {
  let list = prescriptions;

  // 第一階段：狀態過濾
  if (status !== 'all') {
    list = list.filter((p) => p.status === status);
  }

  // 第二階段：文字搜尋
  const q = query.trim().toLowerCase();
  if (!q) return list;

  return list.filter((p) => {
    const resident = residents.find((r) => r.院友id === p.patient_id);
    return (
      p.medication_name.toLowerCase().includes(q) ||
      (resident?.中文姓名 ?? '').includes(q) ||
      (resident?.床號 ?? '').toLowerCase().includes(q)
    );
  });
}
