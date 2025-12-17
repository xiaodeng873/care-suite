/**
 * VMO 排程到期檢查工具
 * 用於檢查年度體檢和約束物品評估的到期狀態
 */

import type { Patient, PatientRestraintAssessment, ScheduleWithDetails } from '../lib/database';

export interface DueItem {
  patient: Patient;
  dueDate: string;
  lastCheckDate: string | null;
  daysUntilDue: number;
  isScheduled: boolean;
  type: 'annual_health_checkup' | 'restraint_assessment';
  displayText: string;
}

/**
 * 檢查自某個日期以來，是否有相關的看診排程
 * @param patient 院友物件
 * @param reasons 可能的看診原因陣列
 * @param schedules 所有排程列表
 * @param sinceDate 起始檢查日期 (上次事件的日期)
 * @returns 是否已安排
 */
const isScheduledSince = (
  patient: Patient,
  reasons: string[],
  schedules: ScheduleWithDetails[],
  sinceDate: Date | null
): boolean => {
  // 如果沒有起始日期，我們無法可靠地判斷，直接返回 false
  if (!sinceDate) {
    return false;
  }
  sinceDate.setHours(0, 0, 0, 0);

  // 尋找在起始日期之後的相關排程
  const relevantSchedules = schedules.filter(schedule => {
    const dateParts = schedule.到診日期.split('-').map(Number);
    const scheduleDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    scheduleDate.setHours(0, 0, 0, 0);
    return scheduleDate > sinceDate;
  });

  for (const schedule of relevantSchedules) {
    const patientInSchedule = schedule.院友列表.find(item => item.院友id === patient.院友id);
    if (patientInSchedule && patientInSchedule.reasons) {
      const hasMatchingReason = patientInSchedule.reasons.some(r => reasons.includes(r.原因名稱));
      if (hasMatchingReason) {
        return true; // 找到匹配的排程
      }
    }
  }

  return false; // 未找到任何匹配的排程
};


/**
 * 檢查年度體檢是否即將到期
 */
export const checkAnnualHealthCheckupDue = (
  patient: Patient,
  lastCheckupDate: string | null,
  schedules: ScheduleWithDetails[],
  reminderDays: number = 14
): DueItem | null => {
  let baseDate: Date;
  if (lastCheckupDate) {
    baseDate = new Date(lastCheckupDate);
  } else if (patient.入住日期) {
    baseDate = new Date(patient.入住日期);
  } else {
    return null;
  }

  const dueDate = new Date(baseDate);
  dueDate.setMonth(dueDate.getMonth() + 12);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDateOnly = new Date(dueDate);
  dueDateOnly.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue > reminderDays || daysUntilDue < 0) {
    return null;
  }
  
  const lastEventDate = lastCheckupDate ? new Date(lastCheckupDate) : (patient.入住日期 ? new Date(patient.入住日期) : null)

  const isScheduled = isScheduledSince(
    patient,
    ['年度體檢'],
    schedules,
    lastEventDate
  );

  const displayText = `[${patient.床號}] ${patient.中文姓氏}${patient.中文名字} - 年度體檢即將到期 (到期日: ${formatDate(dueDate)}, 剩餘 ${daysUntilDue} 天)`;

  return {
    patient,
    dueDate: dueDate.toISOString().split('T')[0],
    lastCheckDate: lastCheckupDate,
    daysUntilDue,
    isScheduled,
    type: 'annual_health_checkup',
    displayText
  };
};

/**
 * 檢查約束物品評估是否即將到期
 */
export const checkRestraintAssessmentDue = (
  patient: Patient,
  lastAssessment: PatientRestraintAssessment | null,
  schedules: ScheduleWithDetails[],
  reminderDays: number = 14
): DueItem | null => {
  if (!lastAssessment) {
    return null;
  }

  let dueDate: Date;
  if (lastAssessment.next_due_date) {
    dueDate = new Date(lastAssessment.next_due_date);
  } else if (lastAssessment.doctor_signature_date) {
    const signatureDate = new Date(lastAssessment.doctor_signature_date);
    dueDate = new Date(signatureDate);
    dueDate.setMonth(dueDate.getMonth() + 6);
  } else {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDateOnly = new Date(dueDate);
  dueDateOnly.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue > reminderDays || daysUntilDue < 0) {
    return null;
  }
  
  // 最終修正：如果沒有醫師簽名日期，則使用評估的建立日期作為比較基準
  const lastEventDate = lastAssessment.doctor_signature_date 
    ? new Date(lastAssessment.doctor_signature_date) 
    : (lastAssessment.created_at ? new Date(lastAssessment.created_at) : null);

  const isScheduled = isScheduledSince(
    patient,
    ['約束物品評估', '約束物品同意書'],
    schedules,
    lastEventDate
  );

  const lastCheckDate = lastAssessment.doctor_signature_date || lastAssessment.created_at;
  const displayText = `[${patient.床號}] ${patient.中文姓氏}${patient.中文名字} - 約束物品評估即將到期 (到期日: ${formatDate(dueDate)}, 剩餘 ${daysUntilDue} 天)`;

  return {
    patient,
    dueDate: dueDate.toISOString().split('T')[0],
    lastCheckDate,
    daysUntilDue,
    isScheduled,
    type: 'restraint_assessment',
    displayText
  };
};


/**
 * 格式化日期為 YYYY-MM-DD
 */
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
