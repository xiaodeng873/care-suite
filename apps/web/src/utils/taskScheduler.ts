import type { PatientHealthTask, FrequencyUnit } from '../lib/database';
import { SYNC_CUTOFF_DATE_STR } from '../lib/database';

// 判斷是否為文件任務
export function isDocumentTask(taskType: string): boolean {
  return taskType === '藥物自存同意書' || taskType === '晚晴計劃';
}

// 判斷是否為監測任務
export function isMonitoringTask(taskType: string): boolean {
  return taskType === '生命表徵' || taskType === '血糖控制' || taskType === '體重控制';
}

// 判斷是否為護理任務
export function isNursingTask(taskType: string): boolean {
  return taskType === '尿導管更換' || taskType === '鼻胃飼管更換' || taskType === '傷口換症';
}

// 判斷是否為晚晴計劃任務
export function isEveningCarePlanTask(taskType: string): boolean {
  return taskType === '晚晴計劃';
}

// [核心修正+調試] 判斷某一天是否應該有任務
export function isTaskScheduledForDate(task: any, date: Date): boolean {
  const DEBUG_TASK_ID = task.patient_id === 52 && task.health_record_type === '生命表徵'; // 調試院友 ID 52 的生命表徵任務

  // 輔助函數：正確格式化本地日期為 YYYY-MM-DD（避免時區偏移）
  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 1. 每日任務：需考慮頻率數值 (例如每 2 天)
  if (task.frequency_unit === 'daily') {
    const freqValue = task.frequency_value || 1;

    // 如果是「每天」，則每天都回傳 true
    if (freqValue === 1) return true;

    // 如果是「每 X 天」，需要一個基準日來計算週期
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const targetDateStr = formatLocalDate(targetDate);  // 🔧 修復：使用本地時間

    let anchorDate: Date | null = null;

    if (DEBUG_TASK_ID) {
      console.log(`  [isTaskScheduledForDate] 檢查日期: ${targetDateStr}`);
      console.log(`    任務ID: ${task.id}, 院友ID: ${task.patient_id}`);
      console.log(`    頻率: 每 ${freqValue} 天`);
      console.log(`    last_completed_at: ${task.last_completed_at || '無'}`);
      console.log(`    created_at: ${task.created_at || '無'}`);
    }

    // [關鍵修正] 優先使用 last_completed_at 作為基準點 (針對未來/未完成的日期)
    // 這確保了如果用戶在 2號 做了(打破規律)，下次會自動變 4號，而不是死板的 3號
    if (task.last_completed_at) {
       const lastCompleted = new Date(task.last_completed_at);
       lastCompleted.setHours(0, 0, 0, 0);
       const lastCompletedStr = formatLocalDate(lastCompleted);  // 🔧 修復：使用本地時間

       // 只有當目標日期在最後完成日「之後」，才使用它作為基準
       if (targetDate > lastCompleted) {
         anchorDate = lastCompleted;
         if (DEBUG_TASK_ID) console.log(`    ✓ 使用 last_completed_at 作為基準: ${lastCompletedStr}`);
       } else {
         if (DEBUG_TASK_ID) console.log(`    ✗ 目標日期 ${targetDateStr} 不在 last_completed_at ${lastCompletedStr} 之後，不使用`);
       }
    }

    // 如果沒有 last_completed_at 或目標日期在它之前 (檢查歷史)，退回使用 created_at
    if (!anchorDate && task.created_at) {
      anchorDate = new Date(task.created_at);
      anchorDate.setHours(0, 0, 0, 0);
      if (DEBUG_TASK_ID) console.log(`    ✓ 使用 created_at 作為基準: ${formatLocalDate(anchorDate)}`);
    }

    if (anchorDate) {
      // 計算相差天數
      const diffTime = targetDate.getTime() - anchorDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const canDivide = diffDays % freqValue === 0;
      const isScheduled = diffDays >= 0 && canDivide;

      if (DEBUG_TASK_ID) {
        console.log(`    相差天數: ${diffDays}`);
        console.log(`    ${diffDays} % ${freqValue} = ${diffDays % freqValue} (能整除: ${canDivide})`);
        console.log(`    最終結果: ${isScheduled ? '✅ 該做' : '❌ 不該做'}`);
      }

      // 1. diffDays 必須 >= 0 (不能早於基準日)
      // 2. 能夠被頻率整除
      return isScheduled;
    }

    if (DEBUG_TASK_ID) console.log(`    ❌ 無法確定基準日期，返回 false`);
    return false;
  }
  
  // 2. 每週任務：檢查特定星期
  if (task.frequency_unit === 'weekly') {
    if (task.specific_days_of_week && task.specific_days_of_week.length > 0) {
       const targetDate = new Date(date);
       targetDate.setHours(0, 0, 0, 0);
       const targetDateStr = formatLocalDate(targetDate);

       // [修復] 先檢查該日期是否在任務創建日期之後
       if (task.created_at) {
         const createdDate = new Date(task.created_at);
         createdDate.setHours(0, 0, 0, 0);

         if (targetDate < createdDate) {
           if (DEBUG_TASK_ID) {
             console.log(`  [weekly 檢查] 檢查日期: ${targetDateStr}`);
             console.log(`    ❌ 該日期在任務創建日期 ${formatLocalDate(createdDate)} 之前，不該做`);
           }
           return false;
         }
       }

       const day = date.getDay(); // JS: 0=Sun...6=Sat
       const dbDay = day === 0 ? 7 : day;
       const isScheduled = task.specific_days_of_week.includes(dbDay);

       if (DEBUG_TASK_ID) {
         console.log(`  [weekly 檢查] 檢查日期: ${targetDateStr}`);
         console.log(`    date.getDay(): ${day} (0=週日, 5=週五, 6=週六)`);
         console.log(`    dbDay: ${dbDay}`);
         console.log(`    specific_days_of_week: ${JSON.stringify(task.specific_days_of_week)}`);
         console.log(`    結果: ${isScheduled ? '✅ 該做' : '❌ 不該做'}`);
       }

       return isScheduled;
    }
    return false;
  }

  // 3. 每月任務：檢查特定日期
  if (task.frequency_unit === 'monthly') {
     if (task.specific_days_of_month && task.specific_days_of_month.length > 0) {
       const targetDate = new Date(date);
       targetDate.setHours(0, 0, 0, 0);

       // [修復] 先檢查該日期是否在任務創建日期之後
       if (task.created_at) {
         const createdDate = new Date(task.created_at);
         createdDate.setHours(0, 0, 0, 0);

         if (targetDate < createdDate) {
           if (DEBUG_TASK_ID) {
             console.log(`  [monthly 檢查] 檢查日期: ${formatLocalDate(targetDate)}`);
             console.log(`    ❌ 該日期在任務創建日期 ${formatLocalDate(createdDate)} 之前，不該做`);
           }
           return false;
         }
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
        const targetDays = task.specific_days_of_week.map(day => day === 7 ? 0 : day);
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
  console.log('🔍 開始查找第一個未完成日期，起點:', startDate);

  const checkDate = new Date(startDate);
  checkDate.setHours(0, 0, 0, 0);

  let daysChecked = 0;

  while (daysChecked < maxDaysToCheck) {
    // 檢查這一天是否應該有任務
    if (isTaskScheduledForDate(task, checkDate)) {
      // 查詢數據庫確認該日期是否有記錄
      const dateStr = checkDate.toISOString().split('T')[0];
      const { data: records, error } = await supabase
        .from('健康記錄主表')
        .select('記錄id')
        .eq('task_id', task.id)
        .eq('記錄日期', dateStr)
        .limit(1);

      if (error) {
        console.error('❌ 查詢記錄時出錯:', error);
        break;
      }

      // 如果這一天沒有記錄，就是我們要找的日期
      if (!records || records.length === 0) {
        console.log('✅ 找到第一個未完成日期:', dateStr);

        // 設置時間
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

      console.log(`   ✓ ${dateStr} 已有記錄，繼續檢查...`);
    }

    // 檢查下一天
    checkDate.setDate(checkDate.getDate() + 1);
    daysChecked++;
  }

  // 如果檢查了 maxDaysToCheck 天都有記錄，返回下一個應該完成的日期
  console.log('⚠️ 已檢查', maxDaysToCheck, '天，都有記錄，返回下一個計劃日期');
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

  // [優先檢查] 如果提供了 recordLookup，先檢查今天是否已完成
  if (recordLookup && todayStr) {
    const todayKey = `${task.id}_${todayStr}`;
    if (recordLookup.has(todayKey)) {
      return false; // 今天已完成，不算逾期
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

  // [優先檢查] 如果提供了 recordLookup，先檢查今天是否已完成
  if (recordLookup && todayStr) {
    const todayKey = `${task.id}_${todayStr}`;
    if (recordLookup.has(todayKey)) {
      return false; // 今天已完成，不算待辦
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
  if (isTaskOverdue(task, recordLookup, todayStr)) return 'overdue';
  if (isTaskPendingToday(task, recordLookup, todayStr)) return 'pending';
  if (isTaskDueSoon(task, recordLookup, todayStr)) return 'due_soon';
  return 'scheduled';
}

export function isRestraintAssessmentOverdue(assessment: any): boolean {
  if (!assessment.next_due_date) return false;
  const today = new Date();
  const dueDate = new Date(assessment.next_due_date);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return dueDateOnly < todayDate;
}

export function isRestraintAssessmentDueSoon(assessment: any): boolean {
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

export function formatFrequencyDescription(task: PatientHealthTask): string {
  const { frequency_unit, frequency_value, specific_days_of_week, specific_days_of_month } = task;
  switch (frequency_unit) {
    case 'daily':
      return frequency_value === 1 ? '每日' : `每 ${frequency_value} 天`;
    case 'weekly':
      if (specific_days_of_week && specific_days_of_week.length > 0 && !isDocumentTask(task.health_record_type)) {
        const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const days = specific_days_of_week.map(day => {
          if (day >= 1 && day <= 7) return dayNames[day === 7 ? 0 : day];
          return null;
        }).filter(Boolean).join(', ');
        return frequency_value === 1 ? `每週 ${days}` : `每 ${frequency_value} 週 ${days}`;
      }
      return frequency_value === 1 ? '每週' : `每 ${frequency_value} 週`;
    case 'monthly':
      if (specific_days_of_month && specific_days_of_month.length > 0 && !isDocumentTask(task.health_record_type)) {
        const dates = specific_days_of_month.join(', ');
        return frequency_value === 1 ? `每月 ${dates} 號` : `每 ${frequency_value} 個月 ${dates} 號`;
      }
      return frequency_value === 1 ? '每月' : `每 ${frequency_value} 個月`;
    case 'yearly':
      return frequency_value === 1 ? '每年' : `每 ${frequency_value} 年`;
    default:
      return '未知頻率';
  }
}