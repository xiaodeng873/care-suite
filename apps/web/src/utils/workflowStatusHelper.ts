/**
 * 藥物工作流程狀態輔助函數
 * 用於檢查和計算工作流程的逾期和未完成狀態
 */

interface WorkflowRecord {
  id: string;
  prescription_id: string;
  patient_id: number;
  scheduled_date: string;
  scheduled_time: string;
  preparation_status: 'pending' | 'completed' | 'failed';
  verification_status: 'pending' | 'completed' | 'failed';
  dispensing_status: 'pending' | 'completed' | 'failed';
  [key: string]: any;
}

interface Prescription {
  id: string;
  preparation_method?: string;
  [key: string]: any;
}

/**
 * 檢查單個工作流程記錄是否逾期未完成
 * @param record 工作流程記錄
 * @returns 是否逾期未完成
 */
export const isWorkflowOverdue = (record: WorkflowRecord): boolean => {
  // 只有派藥狀態為 pending 才需要檢查
  if (record.dispensing_status !== 'pending') {
    return false;
  }

  // 組合日期和時間，確保格式正確
  const scheduledDateTime = new Date(`${record.scheduled_date}T${record.scheduled_time}`);

  // 使用香港時區的當前時間進行比較
  const now = new Date();
  const hkTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Hong_Kong"}));

  // 如果排程時間已經過去，則視為逾期
  const isOverdue = scheduledDateTime < hkTime;

  // 調試日誌（僅在逾期時輸出）
  if (isOverdue) 
 
  return isOverdue;
};

/**
 * 檢查特定日期是否有逾期未完成的流程
 * @param records 所有工作流程記錄
 * @param targetDate 目標日期（格式：YYYY-MM-DD）
 * @returns 是否有逾期未完成的流程
 */
export const hasOverdueWorkflowOnDate = (
  records: WorkflowRecord[],
  targetDate: string
): boolean => {
  const recordsOnDate = records.filter(r => r.scheduled_date === targetDate);
  return recordsOnDate.some(isWorkflowOverdue);
};

/**
 * 計算每個日期的逾期未完成流程數量
 * @param records 所有工作流程記錄
 * @param dates 日期列表
 * @returns 日期到逾期數量的映射
 */
export const calculateOverdueCountByDate = (
  records: WorkflowRecord[],
  dates: string[]
): Map<string, number> => {
  const countMap = new Map<string, number>();

  dates.forEach(date => {
    const recordsOnDate = records.filter(r => r.scheduled_date === date);
    const overdueCount = recordsOnDate.filter(isWorkflowOverdue).length;
    countMap.set(date, overdueCount);
  });

  return countMap;
};

/**
 * 檢查特定備藥方式的處方是否有逾期未完成的流程
 * @param records 所有工作流程記錄
 * @param prescriptions 所有處方
 * @param preparationMethod 備藥方式（'advanced', 'immediate', 或 null 表示所有）
 * @returns 是否有逾期未完成的流程
 */
export const hasOverdueWorkflowByPreparationMethod = (
  records: WorkflowRecord[],
  prescriptions: Prescription[],
  preparationMethod: 'advanced' | 'immediate' | null = null
): boolean => {
  // 如果指定了備藥方式，先過濾處方
  let filteredPrescriptionIds: Set<string>;

  if (preparationMethod) {
    filteredPrescriptionIds = new Set(
      prescriptions
        .filter(p => p.preparation_method === preparationMethod)
        .map(p => p.id)
    );
  } else {
    filteredPrescriptionIds = new Set(prescriptions.map(p => p.id));
  }

  // 過濾相關的工作流程記錄
  const relevantRecords = records.filter(r =>
    filteredPrescriptionIds.has(r.prescription_id)
  );

  // 檢查是否有逾期未完成的記錄
  return relevantRecords.some(isWorkflowOverdue);
};

/**
 * 計算每個備藥方式的逾期未完成流程數量
 * @param records 所有工作流程記錄
 * @param prescriptions 所有處方
 * @returns 備藥方式到逾期數量的映射
 */
export const calculateOverdueCountByPreparationMethod = (
  records: WorkflowRecord[],
  prescriptions: Prescription[]
): {
  all: number;
  advanced: number;
  immediate: number;
} => {
  const prescriptionMap = new Map(prescriptions.map(p => [p.id, p]));

  let allCount = 0;
  let advancedCount = 0;
  let immediateCount = 0;

  records.forEach(record => {
    if (isWorkflowOverdue(record)) {
      allCount++;

      const prescription = prescriptionMap.get(record.prescription_id);
      if (prescription) {
        if (prescription.preparation_method === 'advanced') {
          advancedCount++;
        } else if (prescription.preparation_method === 'immediate') {
          immediateCount++;
        }
      }
    }
  });

  return {
    all: allCount,
    advanced: advancedCount,
    immediate: immediateCount
  };
};

/**
 * 獲取所有有逾期未完成流程的院友列表（用於主面板提醒）
 * @param records 所有工作流程記錄
 * @param patients 所有院友
 * @param prescriptions 所有處方（用於驗證工作流程記錄的有效性）
 * @returns 有逾期流程的院友及其逾期數量和日期信息
 */
export const getPatientsWithOverdueWorkflow = (
  records: WorkflowRecord[],
  patients: any[],
  prescriptions?: any[]
): Array<{
  patient: any;
  overdueCount: number;
  overdueRecords: WorkflowRecord[];
  overdueDates: string[]; // 逾期的日期列表
  earliestOverdueDate: string; // 最早逾期的日期
}> => {
  console.log('🔍 getPatientsWithOverdueWorkflow 開始:', {
    記錄總數: records.length,
    院友總數: patients.length,
    處方總數: prescriptions?.length || 0
  });

  // 如果提供了處方列表，建立處方ID到處方對象的Map用於快速查找
  const prescriptionMap = prescriptions
    ? new Map(prescriptions.map(p => [p.id, p]))
    : null;

  const patientOverdueMap = new Map<number, WorkflowRecord[]>();
  let orphanRecordCount = 0;
  let inactiveRecordCount = 0;

  // 收集每個院友的逾期記錄
  records.forEach(record => {
    // 如果提供了處方列表，檢查記錄是否指向有效的處方
    if (prescriptionMap) {
      const prescription = prescriptionMap.get(record.prescription_id);

      // 處方不存在（孤兒記錄）
      if (!prescription) {
        orphanRecordCount++;
        console.warn('⚠️ 發現孤兒工作流程記錄（處方已刪除）:', {
          記錄ID: record.id,
          處方ID: record.prescription_id,
          院友ID: record.patient_id,
          日期: record.scheduled_date
        });
        return; // 跳過這條孤兒記錄
      }

      // 處方存在但狀態是 pending_change（處方變更中，不應計入逾期）
      if (prescription.status === 'pending_change') {
        inactiveRecordCount++;
        console.warn('⚠️ 發現pending_change處方的工作流程記錄（已排除）:', {
          記錄ID: record.id,
          處方ID: record.prescription_id,
          處方狀態: prescription.status,
          藥物名稱: prescription.medication_name,
          院友ID: record.patient_id,
          日期: record.scheduled_date
        });
        return; // 跳過 pending_change 狀態的處方記錄
      }
    }

    if (isWorkflowOverdue(record)) {
      const patientId = record.patient_id;
      if (!patientOverdueMap.has(patientId)) {
        patientOverdueMap.set(patientId, []);
      }
      patientOverdueMap.get(patientId)!.push(record);
    }
  });

  if (orphanRecordCount > 0) {
    console.warn(`⚠️ 總共跳過 ${orphanRecordCount} 條孤兒工作流程記錄`);
  }
  if (inactiveRecordCount > 0) {
    console.warn(`⚠️ 總共跳過 ${inactiveRecordCount} 條pending_change處方的工作流程記錄`);
  }

  console.log('📊 逾期記錄 Map:', {
    有逾期記錄的院友ID: Array.from(patientOverdueMap.keys()),
    各院友逾期數量: Array.from(patientOverdueMap.entries()).map(([id, records]) => ({
      院友ID: id,
      逾期數: records.length
    }))
  });

  // 轉換為結果數組，並關聯院友資料
  const result: Array<{
    patient: any;
    overdueCount: number;
    overdueRecords: WorkflowRecord[];
    overdueDates: string[];
    earliestOverdueDate: string;
  }> = [];

  patientOverdueMap.forEach((overdueRecords, patientId) => { 
    console.log(`🔍 查找院友 ID: ${patientId} (類型: ${typeof patientId})`);

    // 嘗試多種匹配方式
    const patient = patients.find(p => {
      const pId = p.院友id;
      const match = parseInt(String(pId)) === parseInt(String(patientId));
      if (match) 
      return match;
    });

    if (!patient) {
      console.warn(`❌ 找不到院友 ID: ${patientId}`);
      return;
    }

    if (patient.在住狀態 !== '在住') {
      console.log(`⚠️ 院友 ${patient.床號} 不是在住狀態: ${patient.在住狀態}`);
      return;
    }

    if (patient && patient.在住狀態 === '在住') {
      // 收集所有逾期的日期（去重）
      const overdueDatesSet = new Set<string>();
      overdueRecords.forEach(record => {
        overdueDatesSet.add(record.scheduled_date);
      });
      const overdueDates = Array.from(overdueDatesSet).sort();

      // 找出最早逾期的日期
      const earliestOverdueDate = overdueDates[0];

      result.push({
        patient,
        overdueCount: overdueRecords.length,
        overdueRecords,
        overdueDates,
        earliestOverdueDate
      });
    }
  });

  // 按最早逾期日期排序，然後按逾期數量降序排序
  result.sort((a, b) => {
    const dateCompare = a.earliestOverdueDate.localeCompare(b.earliestOverdueDate);
    if (dateCompare !== 0) return dateCompare;
    return b.overdueCount - a.overdueCount;
  });

  return result;
};
