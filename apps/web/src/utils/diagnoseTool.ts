import { supabase } from '../lib/supabase';
/**
 * 診斷11月2-8日週期內工作流程記錄顯示問題
 */
export async function diagnoseWorkflowDisplayIssue(
  patientId?: number,
  startDate: string = '2025-11-02',
  endDate: string = '2025-11-08'
) {
  if (patientId) {
  }
  // 第1步：檢查處方數據（包含在服和停用處方）
  // 查詢所有處方（不限狀態），只要開始日期在查詢期間內或之前
  let prescQuery = supabase
    .from('new_medication_prescriptions')
    .select('*')
    .lte('start_date', endDate);
  if (patientId) {
    prescQuery = prescQuery.eq('patient_id', patientId);
  }
  const { data: prescriptions, error: prescError } = await prescQuery;
  if (prescError) {
    console.error('❌ 查詢處方失敗:', prescError);
    return;
  }
  const activePrescriptions = prescriptions?.filter(p => p.status === 'active') || [];
  const inactivePrescriptions = prescriptions?.filter(p => p.status === 'inactive') || [];
  // 分析每個處方的頻率設定
  prescriptions.forEach((p: any) => {
    console.log(`\n處方: ${p.medication_name} (ID: ${p.id})`);
    console.log(`  特定星期: ${JSON.stringify(p.specific_weekdays)}`);
    console.log(`  時間槽: ${JSON.stringify(p.medication_time_slots)} (${p.medication_time_slots?.length || 0}個)`);
    // 檢查處方在查詢期間是否有效
    const start = new Date(p.start_date);
    const end = p.end_date ? new Date(p.end_date) : null;
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    const isValid = start <= periodEnd && (!end || end >= periodStart);
    // 對於停用處方，額外說明
    if (p.status === 'inactive') {
    }
    // 檢查每一天是否應該服藥（對所有在期間內有效的處方進行判斷）
    if (isValid) {
      const dates = [];
      let currentDate = new Date(startDate);
      while (currentDate <= new Date(endDate)) {
        const dateStr = currentDate.toISOString().split('T')[0];
        // 檢查日期是否在處方有效期內
        const dateInRange = currentDate >= start && (!end || currentDate <= end);
        const shouldTake = dateInRange ? shouldTakeMedicationOnDate(p, currentDate) : false;
        dates.push({ date: dateStr, shouldTake, dateInRange });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      dates.forEach(d => {
        if (!d.dateInRange) {
        } else {
        }
      });
    } else {
    }
  });
  // 第2步：檢查工作流程記錄
  let recordQuery = supabase
    .from('medication_workflow_records')
    .select('*')
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date')
    .order('scheduled_time');
  if (patientId) {
    recordQuery = recordQuery.eq('patient_id', patientId);
  }
  const { data: records, error: recordError } = await recordQuery;
  if (recordError) {
    console.error('❌ 查詢記錄失敗:', recordError);
    return;
  }
  // 按日期分組統計
  const dateStats: Record<string, any[]> = {};
  records.forEach((record: any) => {
    if (!dateStats[record.scheduled_date]) {
      dateStats[record.scheduled_date] = [];
    }
    dateStats[record.scheduled_date].push(record);
  });
  const allDates = [];
  let currentDate = new Date(startDate);
  while (currentDate <= new Date(endDate)) {
    allDates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  allDates.forEach(date => {
    const dayRecords = dateStats[date] || [];
    if (dayRecords.length > 0) {
      const times = [...new Set(dayRecords.map((r: any) => r.scheduled_time))].sort();
      const prescIds = [...new Set(dayRecords.map((r: any) => r.prescription_id))];
      console.log(`    時間: ${times.join(', ')}`);
    } else {
    }
  });
  // 第3步：檢查記錄與處方的匹配關係
  prescriptions.forEach((p: any) => {
    const prescRecords = records.filter((r: any) => r.prescription_id === p.id);
    console.log(`\n處方: ${p.medication_name} (ID: ${p.id})`);
    if (prescRecords.length === 0) {
    } else {
      // 按日期分組
      const byDate: Record<string, any[]> = {};
      prescRecords.forEach(r => {
        if (!byDate[r.scheduled_date]) byDate[r.scheduled_date] = [];
        byDate[r.scheduled_date].push(r);
      });
      Object.keys(byDate).sort().forEach(date => {
        const times = byDate[date].map(r => r.scheduled_time).sort().join(', ');
        console.log(`  ${date}: ${byDate[date].length} 筆 (時間: ${times})`);
      });
    }
  });
  // 第4步：計算預期記錄數
  let expectedTotal = 0;
  prescriptions.forEach((p: any) => {
    let prescExpected = 0;
    let currentDate = new Date(startDate);
    while (currentDate <= new Date(endDate)) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const start = new Date(p.start_date);
      const end = p.end_date ? new Date(p.end_date) : null;
      // 檢查日期是否在處方有效期內
      if (currentDate >= start && (!end || currentDate <= end)) {
        // 檢查是否根據頻率規則需要服藥
        if (shouldTakeMedicationOnDate(p, currentDate)) {
          const timeSlots = p.medication_time_slots?.length || 0;
          prescExpected += timeSlots;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    const actualCount = records.filter((r: any) => r.prescription_id === p.id).length;
    const match = actualCount === prescExpected ? '✅' : '❌';
    const statusLabel = p.status === 'active' ? '在服' : p.status === 'inactive' ? '停用' : p.status;
    console.log(`處方 ${p.medication_name} (${statusLabel}):`);
    expectedTotal += prescExpected;
  });
  console.log(`  預期總記錄數: ${expectedTotal} (計算所有處方在有效期內的記錄)`);
  // 更精確的匹配判斷
  const activePrescCount = prescriptions.filter((p: any) => p.status === 'active').length;
  const inactivePrescCount = prescriptions.filter((p: any) => p.status === 'inactive').length;
  if (expectedTotal === records.length) {
  } else if (records.length > expectedTotal) {
  } else {
  }
  return {
    prescriptions,
    records,
    expectedTotal,
    actualTotal: records.length,
    isMatched: expectedTotal === records.length,
    activePrescCount,
    inactivePrescCount
  };
}
/**
 * 檢查處方在指定日期是否需要服藥（與 Edge Function 邏輯一致）
 */
function shouldTakeMedicationOnDate(prescription: any, targetDate: Date): boolean {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day } = prescription;
  const startDate = new Date(prescription.start_date);
  switch (frequency_type) {
    case 'daily':
      return true;
    case 'every_x_days':
      const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const daysDiff = Math.floor((targetDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      const interval = frequency_value || 1;
      return daysDiff % interval === 0;
    case 'weekly_days':
      const dayOfWeek = targetDate.getDay();
      const targetDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      return specific_weekdays?.includes(targetDay) || false;
    case 'odd_even_days':
      const dateNumber = targetDate.getDate();
      if (is_odd_even_day === 'odd') {
        return dateNumber % 2 === 1;
      } else if (is_odd_even_day === 'even') {
        return dateNumber % 2 === 0;
      }
      return false;
    case 'every_x_months':
      const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
                        (targetDate.getMonth() - startDate.getMonth());
      const monthInterval = frequency_value || 1;
      return monthsDiff % monthInterval === 0 &&
             targetDate.getDate() === startDate.getDate();
    default:
      return true;
  }
}
// 保留原有的診斷函數以向後兼容
export async function diagnoseMedicationWorkflow() {
  return diagnoseWorkflowDisplayIssue();
}
