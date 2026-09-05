// 監測任務覆蓋率檢查：每名在住院友應具備的最低監測任務頻率。
// 規則（可於此調整）：
//   - 血壓、脈搏、血含氧量、呼吸：每周至少一次（間隔 ≤ 7 天）
//   - 體溫：每天至少一次（間隔 ≤ 1 天）
//   - 體重：每月至少一次（間隔 ≤ 31 天）

export interface CoverageRequirement {
  /** 對應 health_record_type 的生命表徵類型 */
  vital: string;
  /** 允許的最長間隔（天） */
  maxIntervalDays: number;
}

export const MONITORING_COVERAGE_REQUIREMENTS: CoverageRequirement[] = [
  { vital: '血壓', maxIntervalDays: 7 },
  { vital: '脈搏', maxIntervalDays: 7 },
  { vital: '血含氧量', maxIntervalDays: 7 },
  { vital: '呼吸', maxIntervalDays: 7 },
  { vital: '體溫', maxIntervalDays: 1 },
  { vital: '體重', maxIntervalDays: 31 },
];

// 舊版「生命表徵」合併任務視為涵蓋以下逐項生命表徵
const LEGACY_VITALS_COVERED = new Set(['血壓', '脈搏', '血含氧量', '呼吸', '體溫']);

// 可參與「密過每週一次」豁免機制的監測任務類型（每週規則適用者；
// 「生命表徵」為四項合一的合併任務，一併適用）
const EXEMPTABLE_VITALS = new Set(['血壓', '脈搏', '血含氧量', '呼吸', '生命表徵']);

/**
 * 任務的循環間隔（天），直接由循環單位及次數決定，不做任何推算。
 * 每小時 → 0 天；每日 N 次 → N 天；每週 N 次 → 7/N 天；每月 N 次 → 30/N 天。
 */
export function taskIntervalDays(task: any): number {
  const unit = task?.frequency_unit;
  const value = task?.frequency_value || 1;
  if (unit === 'hourly') return 0;
  if (unit === 'daily') return value;
  if (unit === 'weekly') return 7 / value;
  if (unit === 'monthly') return 30 / value;
  if (unit === 'yearly') return 365 / value;
  return Infinity;
}

/** 是否「密過每週一次」的循環任務（間隔少於 7 天）。非循環任務不算。 */
export function isDenseMonitoringTask(task: any): boolean {
  if (task?.is_recurring === false) return false;
  return taskIntervalDays(task) < 7;
}

/** 是否每週一次的可被豁免任務（間距剛好 7 天的循環任務）。 */
function isWeeklyScaleTask(task: any): boolean {
  if (task?.is_recurring === false) return false;
  return taskIntervalDays(task) === 7;
}

/**
 * 計算所有處於豁免狀態的監測任務 id。
 * 規則：四味之一、間距剛好 7 天（每週 1 次或每 7 日 1 次），
 * 而同一院友同一項生命表徵已存在任何密過每週一次的循環任務。
 * 豁免狀態即時推算，不寫入資料庫；密任務被刪除或改疏後自動解除。
 */
export function getExemptedMonitoringTaskIds(allTasks: any[]): Set<string> {
  const exempted = new Set<string>();
  const byPatientVital = new Map<string, any[]>();
  for (const t of allTasks || []) {
    if (!EXEMPTABLE_VITALS.has(t?.health_record_type)) continue;
    const key = `${t.patient_id}|${t.health_record_type}`;
    const list = byPatientVital.get(key);
    if (list) list.push(t);
    else byPatientVital.set(key, [t]);
  }
  for (const tasks of byPatientVital.values()) {
    if (!tasks.some(isDenseMonitoringTask)) continue;
    tasks.forEach(t => {
      if (isWeeklyScaleTask(t)) exempted.add(t.id);
    });
  }
  return exempted;
}

/**
 * 估算一個循環任務的最長間隔（天）。無法保證循環者回傳 Infinity。
 */
export function taskMaxIntervalDays(task: any): number {
  if (task?.is_recurring === false) return Infinity;
  const unit = task?.frequency_unit;
  const value = task?.frequency_value || 1;

  if (unit === 'daily') {
    return value;
  }

  if (unit === 'weekly') {
    const days: number[] = task?.specific_days_of_week || [];
    if (days.length === 0) return Infinity;
    const sorted = [...new Set<number>(days)].sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 0; i < sorted.length; i++) {
      const next = i === sorted.length - 1 ? sorted[0] + 7 : sorted[i + 1];
      maxGap = Math.max(maxGap, next - sorted[i]);
    }
    return maxGap;
  }

  if (unit === 'monthly') {
    const days: number[] = task?.specific_days_of_month || [];
    if (days.length === 0) return Infinity;
    const sorted = [...new Set<number>(days)].sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 0; i < sorted.length; i++) {
      const next = i === sorted.length - 1 ? sorted[0] + 30 : sorted[i + 1];
      maxGap = Math.max(maxGap, next - sorted[i]);
    }
    return maxGap;
  }

  return Infinity;
}

function taskCoversVital(taskType: string, vital: string): boolean {
  if (taskType === vital) return true;
  if (taskType === '生命表徵' && LEGACY_VITALS_COVERED.has(vital)) return true;
  return false;
}

/**
 * 計算某院友欠缺的必要監測項目（依頻率規則）。
 * @param exemptedIds 處於豁免狀態的任務 id（由 getExemptedMonitoringTaskIds 計算）；豁免任務不計算為覆蓋來源。
 * @returns 欠缺的生命表徵類型陣列（例如 ['血壓', '體溫']），無欠缺則為空陣列。
 */
export function getMissingMonitoringVitals(patientTasks: any[], exemptedIds?: Set<string>): string[] {
  const missing: string[] = [];
  for (const req of MONITORING_COVERAGE_REQUIREMENTS) {
    const satisfied = patientTasks.some((t) => {
      if (exemptedIds?.has(t.id)) return false;
      if (!taskCoversVital(t.health_record_type, req.vital)) return false;
      // 四味的每週規則：密過每週一次的任務直接視為達標（不論 taskMaxIntervalDays 能否估算）
      if (EXEMPTABLE_VITALS.has(req.vital) && req.maxIntervalDays === 7 && isDenseMonitoringTask(t)) return true;
      return taskMaxIntervalDays(t) <= req.maxIntervalDays;
    });
    if (!satisfied) missing.push(req.vital);
  }
  return missing;
}
