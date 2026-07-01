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
 * @returns 欠缺的生命表徵類型陣列（例如 ['血壓', '體溫']），無欠缺則為空陣列。
 */
export function getMissingMonitoringVitals(patientTasks: any[]): string[] {
  const missing: string[] = [];
  for (const req of MONITORING_COVERAGE_REQUIREMENTS) {
    const satisfied = patientTasks.some(
      (t) => taskCoversVital(t.health_record_type, req.vital) && taskMaxIntervalDays(t) <= req.maxIntervalDays
    );
    if (!satisfied) missing.push(req.vital);
  }
  return missing;
}
