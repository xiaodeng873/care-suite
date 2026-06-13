import type { PatientTask } from './useTasks';
import type { Resident } from '@/features/residents/types';

/**
 * 跨實體工作搜尋過濾
 * - 搜尋欄位：工作類型、院友中文姓名、院友床號（不區分大小寫）
 * - 純空白查詢視為無查詢
 */
export function filterTasks(
  tasks: PatientTask[],
  residents: Resident[],
  query: string,
): PatientTask[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => {
    const resident = residents.find((r) => r.院友id === t.patient_id);
    return (
      t.health_record_type.toLowerCase().includes(q) ||
      (resident?.中文姓名 ?? '').includes(q) ||
      (resident?.床號 ?? '').toLowerCase().includes(q)
    );
  });
}
