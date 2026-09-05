import type { PatientHealthTask, FrequencyUnit } from '../lib/database';
import { SYNC_CUTOFF_DATE_STR } from '../lib/database';
// 判斷是否為文件任務
export function isDocumentTask(taskType: string): boolean {
  return taskType === '藥物自存同意書' || taskType === '預設醫療指示';
}
// 判斷是否為監測任務
const MONITORING_TASK_TYPES = new Set([
  '血壓', '脈搏', '體溫', '血含氧量', '呼吸', '血糖值', '體重',
  // 向後相容舊類型
  '生命表徵', '血糖控制', '體重控制',
]);
export function isMonitoringTask(taskType: string): boolean {
  return MONITORING_TASK_TYPES.has(taskType);
}
// 「生命表徵」合併任務涵蓋的四項監測類型（記錄仍以逐項保存，完成判定四項任一命中即可）
export const VITAL_SIGN_GROUP_TYPES: readonly string[] = ['血壓', '脈搏', '血含氧量', '呼吸'];

// 任務完成判定適用的監測類型清單：合併任務對應四項，其他任務為自身類型
export function taskRecordVitalTypes(taskType: string): string[] {
  return taskType === '生命表徵' ? [...VITAL_SIGN_GROUP_TYPES] : [taskType];
}

// recordLookup 命中檢查：先按任務 id，後備按 院友+監測類型（合併任務四項任一命中即可）
export function taskHasRecordLookup(task: PatientHealthTask, recordLookup: Set<string>, dateStr: string, timeStr?: string): boolean {
  const suffix = timeStr ? `_${timeStr}` : '';
  if (recordLookup.has(`${task.id}_${dateStr}${suffix}`)) return true;
  const pid = task.patient_id?.toString() || '';
  return taskRecordVitalTypes(task.health_record_type).some(
    (tp) => recordLookup.has(`${pid}_${tp}_${dateStr}${suffix}`)
  );
}
// 判斷是否為護理任務
export function isNursingTask(taskType: string): boolean {
  // 導尿管更換、鼻胃飼管更換 已移至「喉管護理」獨立管理；此處只保留 傷口換症
  return taskType === '傷口換症';
}
// 判斷是否為預設醫療指示任務
export function isEveningCarePlanTask(taskType: string): boolean {
  return taskType === '預設醫療指示';
}
// [核心修正+調試] 判斷某一天是否應該有任務
export function isTaskScheduledForDate(task: any, date: Date): boolean {
  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  // [時區修復] 以 UTC 日曆日作為「建立邊界」，與 next_due_at（以 UTC 午夜儲存）一致。
  // 避免 created_at 働晚時間（UTC）在正時區被進位到隳天，導致任務在其自身應做日被誤判為「尚未建立」而跳過。
  const createdBoundaryStr = task.created_at
    ? (() => {
        const c = new Date(task.created_at);
        return `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, '0')}-${String(c.getUTCDate()).padStart(2, '0')}`;
      })()
    : null;
  // 若明確設定了 start_date，以本地日期作為排程邊界（允許早於 created_at UTC 日期）。
  // 修正：今日新增、start_date 為昨日的任務，昨日應被視為已排程（逾期）。
  const effectiveBoundaryStr = task.start_date
    ? (() => {
        const s = new Date(task.start_date);
        return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
      })()
    : createdBoundaryStr;
  if (task.frequency_unit === 'daily') {
    const freqValue = task.frequency_value || 1;
    if (freqValue === 1) {
      if (effectiveBoundaryStr && formatLocalDate(date) < effectiveBoundaryStr) {
        return false;
      }
      return true;
    }
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    let anchorDate: Date | null = null;
    if (task.last_completed_at) {
       const lastCompleted = new Date(task.last_completed_at);
       lastCompleted.setHours(0, 0, 0, 0);
       if (targetDate > lastCompleted) {
         anchorDate = lastCompleted;
       }
    }
    if (!anchorDate && task.start_date) {
      anchorDate = new Date(task.start_date);
      anchorDate.setHours(0, 0, 0, 0);
    }
    if (!anchorDate && task.created_at) {
      anchorDate = new Date(task.created_at);
      anchorDate.setHours(0, 0, 0, 0);
    }
    if (anchorDate) {
      const diffTime = targetDate.getTime() - anchorDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const canDivide = diffDays % freqValue === 0;
      const isScheduled = diffDays >= 0 && canDivide;
      return isScheduled;
    }
    return false;
  }
  // 2. 每週任務：檢查特定星期
  if (task.frequency_unit === 'weekly') {
    if (task.specific_days_of_week && task.specific_days_of_week.length > 0) {
       const targetDate = new Date(date);
       targetDate.setHours(0, 0, 0, 0);
       const targetDateStr = formatLocalDate(targetDate);
       if (effectiveBoundaryStr && targetDateStr < effectiveBoundaryStr) {
         return false;
       }
       const day = date.getDay();
       const dbDay = day === 0 ? 7 : day;
       const isScheduled = task.specific_days_of_week.includes(dbDay);
       return isScheduled;
    }
    return false;
  }
  // 3. 每月任務：檢查特定日期
  if (task.frequency_unit === 'monthly') {
     if (task.specific_days_of_month && task.specific_days_of_month.length > 0) {
       const targetDate = new Date(date);
       targetDate.setHours(0, 0, 0, 0);
       if (effectiveBoundaryStr && formatLocalDate(targetDate) < effectiveBoundaryStr) {
         return false;
       }
       return task.specific_days_of_month.includes(date.getDate());
     }
  }
  return false;
}
export function calculateNextDueDate(task: PatientHealthTask, fromDate?: Date): Date {
  if (!task.is_recurring) {
    return fromDate || new Date();
  }
  let nextDueDate = new Date(fromDate || new Date());
  switch (task.frequency_unit) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + (task.frequency_value || 1));
      break;
    case 'weekly':
      if (task.specific_days_of_week && task.specific_days_of_week.length > 0) {
        const currentDayOfWeek = nextDueDate.getDay();
        const targetDays = task.specific_days_of_week.map(day => day === 7 ? 0 : day).sort((a, b) => a - b);
        // 如果當天本身就在指定星期中，以當天為下次到期日；否則找下一個最近指定日
        if (!targetDays.includes(currentDayOfWeek)) {
          let daysToAdd = null;
          for (let i = 1; i <= 7; i++) {
            const checkDay = (currentDayOfWeek + i) % 7;
            if (targetDays.includes(checkDay)) {
              daysToAdd = i;
              break;
            }
          }
          if (daysToAdd !== null) {
            nextDueDate.setDate(nextDueDate.getDate() + daysToAdd);
          } else {
            nextDueDate.setDate(nextDueDate.getDate() + 7);
          }
        }
      } else {
        nextDueDate.setDate(nextDueDate.getDate() + (task.frequency_value || 1) * 7);
      }
      break;
    case 'monthly':
      if (task.specific_days_of_month && task.specific_days_of_month.length > 0) {
        const currentDate = nextDueDate.getDate();
        const currentMonth = nextDueDate.getMonth();
        const futureTargetDays = task.specific_days_of_month.filter(day => day > currentDate);
        if (futureTargetDays.length > 0) {
          const nextTargetDay = Math.min(...futureTargetDays);
          nextDueDate.setDate(nextTargetDay);
        } else {
          nextDueDate.setMonth(currentMonth + (task.frequency_value || 1));
          const nextTargetDay = Math.min(...task.specific_days_of_month);
          nextDueDate.setDate(nextTargetDay);
        }
      } else {
        nextDueDate.setMonth(nextDueDate.getMonth() + (task.frequency_value || 1));
      }
      break;
    case 'yearly':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + (task.frequency_value || 1));
      break;
    default:
      nextDueDate.setDate(nextDueDate.getDate() + 1);
  }
  if (task.specific_times && task.specific_times.length > 0) {
    const timeStr = task.specific_times[0];
    if (timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      nextDueDate.setHours(hours, minutes, 0, 0);
    }
  } else if (isMonitoringTask(task.health_record_type)) {
    nextDueDate.setHours(8, 0, 0, 0);
  }
  return nextDueDate;
}
// [策略2：智能推進] 找到從 startDate 開始的第一個未完成日期
export async function findFirstMissingDate(
  task: PatientHealthTask,
  startDate: Date,
  supabase: any,
  maxDaysToCheck: number = 90
): Promise<Date> {
  // 「生命表徵」合併任務：以四項中任何一項記錄視為完成
  const matchTypes = taskRecordVitalTypes(task.health_record_type);
  const typeClause = matchTypes.length === 1
    ? `監測類型.eq.${matchTypes[0]}`
    : `監測類型.in.(${matchTypes.join(',')})`;
  const recordMatchesTask = (r: any) => {
    if (r.任務id === task.id) return true;
    if (!r.任務id) return r.院友id === task.patient_id && matchTypes.includes(r.監測類型);
    return false;
  };
  const checkDate = new Date(startDate);
  checkDate.setHours(0, 0, 0, 0);
  let daysChecked = 0;
  while (daysChecked < maxDaysToCheck) {
    // 檢查這一天是否應該有任務
    if (isTaskScheduledForDate(task, checkDate)) {
      // [修復] 使用本地日期格式，避免 toISOString() 返回 UTC 日期（在 UTC+8 會早一天）
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
      // [修復] 對於多時間點任務，需要檢查特定時間點的記錄
      if (task.specific_times && task.specific_times.length > 0) {
        // 標準化時間格式
        const normalizeTime = (time: string) => {
          if (!time) return '';
          return time.substring(0, 5); // 取前5個字符 "HH:MM"
        };
        // [優化] 一次性查詢該日期的所有記錄
        const { data: records, error } = await supabase
          .from('健康監測記錄')
          .select('記錄id, 記錄時間, 院友id, 監測類型, 任務id')
          .eq('記錄日期', dateStr)
          .or(`任務id.eq.${task.id},and(院友id.eq.${task.patient_id},${typeClause})`);
        if (error) {
          break;
        }
        // 過濾出屬於該任務的記錄：
        // - 有 任務id 且等於本任務：精確匹配
        // - 無 任務id（舊記錄）且 院友id+監測類型 匹配：後備匹配
        // [修復] 排除屬於其他任務的記錄，避免誤判為本任務已完成
        const taskRecords = (records || []).filter(recordMatchesTask);
        // 收集已完成的時間點
        const completedTimes = new Set(
          taskRecords.map((r: any) => normalizeTime(r.記錄時間))
        );
        // 檢查每個時間點是否都有記錄
        let allTimesCompleted = true;
        let firstMissingTime: string | null = null;
        for (const time of task.specific_times) {
          const normalizedTime = normalizeTime(time);
          if (!completedTimes.has(normalizedTime)) {
            allTimesCompleted = false;
            firstMissingTime = time;
            break;
          }
        }
        if (!allTimesCompleted && firstMissingTime) {
          const [hours, minutes] = firstMissingTime.split(':').map(Number);
          checkDate.setHours(hours, minutes, 0, 0);
          return checkDate;
        }
      } else {
        // [修復] 選取 任務id 以便後備過濾
        const { data: records, error } = await supabase
          .from('健康監測記錄')
          .select('記錄id, 任務id, 院友id, 監測類型')
          .eq('記錄日期', dateStr)
          .or(`任務id.eq.${task.id},and(院友id.eq.${task.patient_id},${typeClause})`);
        if (error) {
          break;
        }
        // [修復] 排除屬於其他任務的記錄
        const taskRecords = (records || []).filter(recordMatchesTask);
        if (taskRecords.length === 0) {
          if (task.specific_times && task.specific_times.length > 0) {
            const timeStr = task.specific_times[0];
            if (timeStr.includes(':')) {
              const [hours, minutes] = timeStr.split(':').map(Number);
              checkDate.setHours(hours, minutes, 0, 0);
            }
          } else if (isMonitoringTask(task.health_record_type)) {
            checkDate.setHours(8, 0, 0, 0);
          }
          return checkDate;
        }
      }
    }
    // 檢查下一天
    checkDate.setDate(checkDate.getDate() + 1);
    daysChecked++;
  }
  // 如果檢查了 maxDaysToCheck 天都有記錄，返回下一個應該完成的日期
  return calculateNextDueDate(task, checkDate);
}
// 補回其他函式以避免錯誤
export function isTaskOverdue(task: PatientHealthTask, recordLookup?: Set<string>, todayStr?: string): boolean {
  if (!task.next_due_at) return false;
  // [分界線檢查] 如果 next_due_at 在分界線之前或當天，視為「歷史任務」，不算逾期
  const CUTOFF_DATE = new Date(SYNC_CUTOFF_DATE_STR);
  const dueDate = new Date(task.next_due_at);
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const cutoffDateOnly = new Date(CUTOFF_DATE.getFullYear(), CUTOFF_DATE.getMonth(), CUTOFF_DATE.getDate());
  if (dueDateOnly <= cutoffDateOnly) {
    return false;
  }
  // [優先檢查] 如果提供了 recordLookup，先檢查 next_due_at 指向的日期是否已完成
  if (recordLookup) {
    const dueDateStr = dueDate.toISOString().split('T')[0];
    // [修復] 對於多時間點任務，檢查 next_due_at 時間點是否已完成
    if (task.specific_times && task.specific_times.length > 0) {
      const normalizeTime = (time: string) => time ? time.substring(0, 5) : '';
      const dueTimeStr = dueDate.toTimeString().substring(0, 5); // HH:MM
      const normalizedDueTime = normalizeTime(dueTimeStr);
      if (taskHasRecordLookup(task, recordLookup, dueDateStr, normalizedDueTime)) {
        return false; // next_due_at 指向的時間點已完成，不算逾期
      }
    } else {
      // 單時間點或無時間點任務
      if (taskHasRecordLookup(task, recordLookup, dueDateStr)) {
        return false; // next_due_at 指向的日期已完成，不算逾期
      }
    }
    // 另外檢查今天是否已完成（額外保險）
    if (todayStr) {
      if (taskHasRecordLookup(task, recordLookup, todayStr)) {
        return false; // 今天已完成，不算逾期
      }
    }
  }
  const now = new Date();
  if (isDocumentTask(task.health_record_type)) {
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    if (dueDateOnly < nowDate) {
      if (!task.last_completed_at) return true;
      const lastCompleted = new Date(task.last_completed_at);
      const lastCompletedDate = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());
      return lastCompletedDate < dueDateOnly;
    }
    return false;
  }
  if (task.last_completed_at) {
    const lastCompleted = new Date(task.last_completed_at);
    if (lastCompleted >= dueDate) return false;
  }
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDate < todayStart;
}
export function isTaskPendingToday(task: PatientHealthTask, recordLookup?: Set<string>, todayStr?: string): boolean {
  if (!task.next_due_at) return false;
  // [分界線檢查] 如果 next_due_at 在分界線之前或當天，視為「歷史任務」，不算今天待辦
  const CUTOFF_DATE = new Date(SYNC_CUTOFF_DATE_STR);
  const dueDate = new Date(task.next_due_at);
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const cutoffDateOnly = new Date(CUTOFF_DATE.getFullYear(), CUTOFF_DATE.getMonth(), CUTOFF_DATE.getDate());
  if (dueDateOnly <= cutoffDateOnly) {
    return false;
  }
  // [優先檢查] 如果提供了 recordLookup，先檢查 next_due_at 指向的日期是否已完成
  if (recordLookup) {
    const dueDateStr = dueDate.toISOString().split('T')[0];
    // [修復] 對於多時間點任務，檢查 next_due_at 時間點是否已完成
    if (task.specific_times && task.specific_times.length > 0) {
      const normalizeTime = (time: string) => time ? time.substring(0, 5) : '';
      const dueTimeStr = dueDate.toTimeString().substring(0, 5); // HH:MM
      const normalizedDueTime = normalizeTime(dueTimeStr);
      if (taskHasRecordLookup(task, recordLookup, dueDateStr, normalizedDueTime)) {
        return false; // next_due_at 指向的時間點已完成，不算待辦
      }
    } else {
      // 單時間點或無時間點任務
      if (taskHasRecordLookup(task, recordLookup, dueDateStr)) {
        return false; // next_due_at 指向的日期已完成，不算待辦
      }
    }
    // 另外檢查今天是否已完成（額外保險）
    if (todayStr) {
      if (taskHasRecordLookup(task, recordLookup, todayStr)) {
        return false; // 今天已完成，不算待辦
      }
    }
  }
  const now = new Date();
  if (isDocumentTask(task.health_record_type)) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    if (dueDateOnly.getTime() === todayStart.getTime()) {
      if (!task.last_completed_at) return true;
      const lastCompleted = new Date(task.last_completed_at);
      const lastCompletedDate = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());
      return lastCompletedDate < dueDateOnly;
    }
    return false;
  }
  if (task.last_completed_at) {
    const lastCompleted = new Date(task.last_completed_at);
    if (lastCompleted >= dueDate) return false;
  }
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return dueDate >= todayStart && dueDate <= todayEnd;
}
export function isTaskDueSoon(task: PatientHealthTask, recordLookup?: Set<string>, todayStr?: string): boolean {
  if (!task.next_due_at) return false;
  // [分界線檢查] 如果 next_due_at 在分界線之前或當天，視為「歷史任務」，不算即將到期
  const CUTOFF_DATE = new Date(SYNC_CUTOFF_DATE_STR);
  const dueDate = new Date(task.next_due_at);
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const cutoffDateOnly = new Date(CUTOFF_DATE.getFullYear(), CUTOFF_DATE.getMonth(), CUTOFF_DATE.getDate());
  if (dueDateOnly <= cutoffDateOnly) {
    return false;
  }
  // [優先檢查] 如果提供了 recordLookup，先檢查今天是否已完成
  if (recordLookup && todayStr) {
    const todayKey = `${task.id}_${todayStr}`;
    if (recordLookup.has(todayKey)) {
      return false; // 今天已完成，不算即將到期
    }
  }
  const now = new Date();
  if (isDocumentTask(task.health_record_type)) {
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const twoWeeksLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    if (dueDateOnly >= tomorrowStart && dueDateOnly <= twoWeeksLater) {
      if (!task.last_completed_at) return true;
      const lastCompleted = new Date(task.last_completed_at);
      const lastCompletedDate = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());
      return lastCompletedDate < dueDateOnly;
    }
    return false;
  }
  if (task.last_completed_at) {
    const lastCompleted = new Date(task.last_completed_at);
    if (lastCompleted >= dueDate) return false;
  }
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return dueDate >= tomorrowStart && dueDate <= next24Hours;
}
export function isTaskScheduled(task: PatientHealthTask): boolean {
  if (!task.next_due_at) return false;
  const now = new Date();
  const dueDate = new Date(task.next_due_at);
  if (isDocumentTask(task.health_record_type)) {
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    if (dueDateOnly > nowDate) return true;
    if (task.last_completed_at) {
      const lastCompleted = new Date(task.last_completed_at);
      const lastCompletedDate = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());
      return lastCompletedDate >= dueDateOnly;
    }
    return false;
  }
  if (task.last_completed_at) {
    const lastCompleted = new Date(task.last_completed_at);
    if (lastCompleted >= dueDate) return true;
  }
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (dueDate >= tomorrowStart) return true;
  return false;
}
export function getTaskStatus(task: PatientHealthTask, recordLookup?: Set<string>, todayStr?: string): 'overdue' | 'pending' | 'due_soon' | 'scheduled' {
  // [統一邏輯] 監測類任務改用與主畫面相同的「首個未完成日期」掃描，避免 next_due_at 過時造成狀態不一致
  if (isMonitoringTask(task.health_record_type)) {
    const first = getFirstIncompleteMonitoringDate(task, recordLookup, todayStr);
    if (!first) return 'scheduled';
    const t = todayStr || new Date().toISOString().split('T')[0];
    const firstStr = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(first.getDate()).padStart(2, '0')}`;
    return firstStr < t ? 'overdue' : 'pending';
  }
  if (isTaskOverdue(task, recordLookup, todayStr)) return 'overdue';
  if (isTaskPendingToday(task, recordLookup, todayStr)) return 'pending';
  if (isTaskDueSoon(task, recordLookup, todayStr)) return 'due_soon';
  return 'scheduled';
}

// [統一邏輯] 計算監測類任務首個未完成的應做日期（由今天往回掃描 28 天），與 Dashboard.urgentMonitoringTasks 一致
export function getFirstIncompleteMonitoringDate(task: PatientHealthTask, recordLookup?: Set<string>, _todayStr?: string): Date | null {
  if (!isMonitoringTask(task.health_record_type)) return null;
  const fmt = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const normalize = (time: string) => time ? time.substring(0, 5) : '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskStartDate = task.start_date ? new Date(task.start_date) : null;
  if (taskStartDate) taskStartDate.setHours(0, 0, 0, 0);
  const normalizedTaskTimes = (task as any).specific_times?.map(normalize) || [];
  let firstIncomplete: Date | null = null;
  // [修正] 掃描窗口由 28 天改為 60 天，與 Dashboard.urgentMonitoringTasks 一致，
  // 避免月週期任務（如每月 1 日體重）在月底被遺漏。
  for (let i = 0; i <= 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = fmt(checkDate);
    if (dateStr <= SYNC_CUTOFF_DATE_STR) continue;
    if (taskStartDate && checkDate < taskStartDate) continue;
    if (!isTaskScheduledForDate(task, checkDate)) continue;
    let completed = false;
    if (recordLookup) {
      if (normalizedTaskTimes.length > 0) {
        completed = normalizedTaskTimes.every((time: string) =>
          taskHasRecordLookup(task, recordLookup, dateStr, time));
      } else {
        completed = taskHasRecordLookup(task, recordLookup, dateStr);
      }
    }
    if (!completed) firstIncomplete = new Date(checkDate); // 持續覆寫：循環從今天往回扫描，最後賦値 = 最早未完成日期
  }
  return firstIncomplete;
}
export function isRestraintAssessmentOverdue(assessment: any): boolean {
  if (assessment.is_terminated) return false;
  if (!assessment.next_due_date) return false;
  const today = new Date();
  const dueDate = new Date(assessment.next_due_date);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return dueDateOnly < todayDate;
}
export function isRestraintAssessmentDueSoon(assessment: any): boolean {
  if (assessment.is_terminated) return false;
  if (!assessment.next_due_date) return false;
  const today = new Date();
  const dueDate = new Date(assessment.next_due_date);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const fourWeeksLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 28);
  return dueDateOnly >= todayDate && dueDateOnly <= fourWeeksLater;
}
export function isHealthAssessmentOverdue(assessment: any): boolean {
  if (!assessment.next_due_date) return false;
  const today = new Date();
  const dueDate = new Date(assessment.next_due_date);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return dueDateOnly < todayDate;
}
export function isHealthAssessmentDueSoon(assessment: any): boolean {
  if (!assessment.next_due_date) return false;
  const today = new Date();
  const dueDate = new Date(assessment.next_due_date);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const oneMonthLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  return dueDateOnly >= todayDate && dueDateOnly <= oneMonthLater;
}
export function getRestraintStatus(assessment: any): 'overdue' | 'due_soon' | 'scheduled' {
  if (isRestraintAssessmentOverdue(assessment)) return 'overdue';
  if (isRestraintAssessmentDueSoon(assessment)) return 'due_soon';
  return 'scheduled';
}
export function getHealthAssessmentStatus(assessment: any): 'overdue' | 'due_soon' | 'scheduled' {
  if (isHealthAssessmentOverdue(assessment)) return 'overdue';
  if (isHealthAssessmentDueSoon(assessment)) return 'due_soon';
  return 'scheduled';
}
// ===== 喉管護理 =====
export function isTubeCareOverdue(record: any): boolean {
  if (record?.is_terminated) return false;
  if (!record?.next_due_date) return false;
  const today = new Date();
  const dueDate = new Date(record.next_due_date);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return dueDateOnly < todayDate;
}
export function isTubeCareDueSoon(record: any): boolean {
  if (record?.is_terminated) return false;
  if (!record?.next_due_date) return false;
  const today = new Date();
  const dueDate = new Date(record.next_due_date);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const sevenDaysLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  return dueDateOnly >= todayDate && dueDateOnly <= sevenDaysLater;
}
export function getTubeCareStatus(record: any): 'overdue' | 'due_soon' | 'scheduled' {
  if (isTubeCareOverdue(record)) return 'overdue';
  if (isTubeCareDueSoon(record)) return 'due_soon';
  return 'scheduled';
}
// 依類型/材質/週期計算下次到期日（回傳 yyyy-mm-dd）
export function calculateTubeCareNextDueDate(params: {
  care_type: string;
  execution_date: string;
  tube_material?: string | null;
  cycle_days?: number | null;
  oxygen_action?: string | null;
  wash_cycle_days?: number | null;
  replace_cycle_days?: number | null;
}): string | undefined {
  const { care_type, execution_date, tube_material, cycle_days, oxygen_action, wash_cycle_days, replace_cycle_days } = params;
  if (!execution_date) return undefined;
  const base = new Date(execution_date);
  if (Number.isNaN(base.getTime())) return undefined;
  let days: number | undefined;
  if (care_type === '氧氣喉管清洗/更換') {
    // 氧氣：清洗用清洗間隔、更換用更換間隔，各自獨立計算
    days = oxygen_action === '更換' ? (replace_cycle_days ?? undefined) : (wash_cycle_days ?? undefined);
  } else if (care_type === '造口袋更換') {
    // 造口袋：固定預設間隔 7 天，可自由調整
    days = cycle_days ?? 7;
  } else {
    // 導尿管 / 鼻胃飼管：Latex +14、Silicon +28；若有自訂 cycle_days 則優先
    if (typeof cycle_days === 'number' && cycle_days > 0) {
      days = cycle_days;
    } else if (tube_material === 'Silicon') {
      days = 28;
    } else if (tube_material === 'Latex') {
      days = 14;
    }
  }
  if (typeof days !== 'number' || days <= 0) return undefined;
  const due = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const yyyy = due.getFullYear();
  const mm = String(due.getMonth() + 1).padStart(2, '0');
  const dd = String(due.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
export function formatFrequencyDescription(task: PatientHealthTask): string {
  const { frequency_unit, frequency_value, specific_days_of_week, specific_days_of_month } = task;
  switch (frequency_unit) {
    case 'daily':
      return frequency_value === 1 ? '每日 1 次' : `每 ${frequency_value} 日 1 次`;
    case 'weekly':
      if (specific_days_of_week && specific_days_of_week.length > 0 && !isDocumentTask(task.health_record_type)) {
        const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const days = specific_days_of_week.map(day => {
          if (day >= 1 && day <= 7) return dayNames[day === 7 ? 0 : day];
          return null;
        }).filter(Boolean).join(', ');
        return frequency_value === 1 ? `每週 ${days}` : `每 ${frequency_value} 週 ${days}`;
      }
      return frequency_value === 1 ? '每週 1 次' : `每 ${frequency_value} 週 1 次`;
    case 'monthly':
      if (specific_days_of_month && specific_days_of_month.length > 0 && !isDocumentTask(task.health_record_type)) {
        const dates = specific_days_of_month.join(', ');
        return frequency_value === 1 ? `每月 ${dates} 號` : `每 ${frequency_value} 個月 ${dates} 號`;
      }
      return frequency_value === 1 ? '每月 1 次' : `每 ${frequency_value} 個月 1 次`;
    case 'yearly':
      return frequency_value === 1 ? '每年 1 次' : `每 ${frequency_value} 年 1 次`;
    default:
      return '未知頻率';
  }
}