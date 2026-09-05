import type { MedicationPrescription, PatientHealthTask, InspectionVitalSignType } from '../lib/database';
import type { VitalSignType } from '../lib/database';
import { VITAL_SIGN_GROUP_TYPES } from './taskScheduler';

// 處方檢測項條件 → 監測任務類型對照（上壓/下壓 都對應血壓任務）
export const RULE_TO_TASK_TYPE: Record<InspectionVitalSignType, VitalSignType> = {
  '上壓': '血壓',
  '下壓': '血壓',
  '脈搏': '脈搏',
  '血糖值': '血糖值',
  '呼吸': '呼吸',
  '血含氧量': '血含氧量',
  '體溫': '體溫',
};

export interface MissingMonitoringTask {
  key: string;
  patientId: number;
  medicationName: string;
  prescriptionId: string;
  administrationRoute?: string;
  ruleVitalSign: InspectionVitalSignType;
  taskType: VitalSignType;
  timeSlot: string;
}

// HH:MM 減 30 分鐘
export const minus30Minutes = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m - 30 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// 現有任務是否符合：同一院友、同一監測類型、循環任務、備註「服藥前」或「注射前」、
// 特定時間 = 服藥時間點正點 或 前半個小時
const taskMatches = (
  task: PatientHealthTask,
  patientId: number,
  taskType: VitalSignType,
  timeSlot: string
): boolean => {
  if (task.patient_id !== patientId) return false;
  // 「生命表徵」合併任務涵蓋四項，視為符合任何一項的檢測條件
  if (task.health_record_type === '生命表徵'
    ? !VITAL_SIGN_GROUP_TYPES.includes(taskType)
    : task.health_record_type !== taskType) return false;
  if (task.is_recurring === false) return false;
  if (task.notes !== '服藥前' && task.notes !== '注射前') return false;
  const times = task.specific_times || [];
  return times.some((t) => t === timeSlot || t === minus30Minutes(timeSlot));
};

/**
 * 搵出「在服處方有檢測項條件，但院友欠對應服藥前循環監測任務」嘅組合。
 * 每個（院友 × 檢測項 × 服藥時間點）只報一次。
 */
export const findMissingMonitoringTasks = (
  prescriptions: MedicationPrescription[],
  tasks: PatientHealthTask[]
): MissingMonitoringTask[] => {
  const results: MissingMonitoringTask[] = [];
  const seen = new Set<string>();

  const activeWithRules = (prescriptions || []).filter(
    (p) => p.status === 'active' && (p.inspection_rules || []).length > 0 && (p.medication_time_slots || []).length > 0
  );

  for (const rx of activeWithRules) {
    for (const rule of rx.inspection_rules || []) {
      const taskType = RULE_TO_TASK_TYPE[rule.vital_sign_type];
      if (!taskType) continue;
      for (const slot of rx.medication_time_slots || []) {
        if (!slot) continue;
        const dedupeKey = `${rx.patient_id}|${taskType}|${slot}`;
        if (seen.has(dedupeKey)) continue;
        const covered = tasks.some((t) => taskMatches(t, rx.patient_id, taskType, slot));
        if (!covered) {
          seen.add(dedupeKey);
          results.push({
            key: dedupeKey,
            patientId: rx.patient_id,
            medicationName: rx.medication_name,
            prescriptionId: rx.id,
            administrationRoute: rx.administration_route,
            ruleVitalSign: rule.vital_sign_type,
            taskType,
            timeSlot: slot,
          });
        }
      }
    }
  }

  return results;
};
