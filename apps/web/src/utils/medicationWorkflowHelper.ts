import { supabase } from '../lib/supabase';

export interface WorkflowRecord {
  id: string;
  prescription_id: string;
  patient_id: number;
  scheduled_date: string;
  scheduled_time: string;
  preparation_status: 'pending' | 'completed' | 'failed';
  verification_status: 'pending' | 'completed' | 'failed';
  dispensing_status: 'pending' | 'completed' | 'failed';
  preparation_staff?: string;
  verification_staff?: string;
  dispensing_staff?: string;
  preparation_time?: string;
  verification_time?: string;
  dispensing_time?: string;
  dispensing_failure_reason?: string;
  custom_failure_reason?: string;
  inspection_check_result?: any;
  notes?: string;
}

export interface StaffCodeMapping {
  [staffName: string]: string;
}

const RESERVED_CODES = ['A', 'S', 'R', 'O'];

export const getAvailableStaffCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 66; i <= 90; i++) {
    const code = String.fromCharCode(i);
    if (!RESERVED_CODES.includes(code)) {
      codes.push(code);
    }
  }
  return codes;
};

export const generateStaffCodeMapping = (staffNames: string[]): StaffCodeMapping => {
  const uniqueStaffNames = [...new Set(staffNames)].filter(name => name && name.trim());
  const availableCodes = getAvailableStaffCodes();
  const mapping: StaffCodeMapping = {};

  console.log('[generateStaffCodeMapping] 輸入人員姓名數量:', staffNames.length);
  console.log('[generateStaffCodeMapping] 去重後人員數量:', uniqueStaffNames.length);
  console.log('[generateStaffCodeMapping] 可用代號數量:', availableCodes.length);

  uniqueStaffNames.forEach((name, index) => {
    if (index < availableCodes.length) {
      mapping[name] = availableCodes[index];
      console.log(`  [映射] ${name} → ${availableCodes[index]}`);
    } else {
      console.warn(`  [警告] 人員 "${name}" 超出可用代號範圍 (index=${index})`);
    }
  });

  console.log('[generateStaffCodeMapping] 生成映射完成，共', Object.keys(mapping).length, '個人員');

  return mapping;
};

export const formatStaffCodeNotation = (staffCodeMapping: StaffCodeMapping): { line1: string; line2: string } => {
  const entries = Object.entries(staffCodeMapping);
  const formatted = entries.map(([name, code]) => `${name}=${code}`);

  const maxLine1Length = 5;
  const line1Items = formatted.slice(0, maxLine1Length);
  const line2Items = formatted.slice(maxLine1Length);

  return {
    line1: line1Items.join(', '),
    line2: line2Items.join(', ')
  };
};

export const fetchWorkflowRecordsForMonth = async (
  patientId: number,
  prescriptionIds: string[],
  yearMonth: string
): Promise<WorkflowRecord[]> => {
  try {
    const [year, month] = yearMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;

    const uniquePrescriptionIds = [...new Set(prescriptionIds)];

    console.log('\n========== 執核派記錄查詢診斷 ==========');
    console.log(`院友ID: ${patientId}`);
    console.log(`查詢月份: ${yearMonth} (${startDate} ~ ${endDate})`);
    console.log(`處方數量 (原始): ${prescriptionIds.length} 個`);
    console.log(`處方數量 (去重): ${uniquePrescriptionIds.length} 個`);
    console.log(`處方ID列表:`, uniquePrescriptionIds);
    console.log(`處方ID類型檢查:`, uniquePrescriptionIds.map(id => `${id} (${typeof id})`));

    const { data, error } = await supabase
      .from('medication_workflow_records')
      .select('*')
      .eq('patient_id', patientId)
      .in('prescription_id', uniquePrescriptionIds)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ 查詢執核派記錄失敗:', error);
      console.error('錯誤詳情:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log(`✓ 查詢成功，返回 ${data?.length || 0} 條執核派記錄`);

    if (!data || data.length === 0) {
      console.warn('⚠️ 警告：查詢返回空結果！');
      console.warn('正在驗證資料庫中是否存在該院友的執核派記錄...');

      const { data: allRecords, error: verifyError } = await supabase
        .from('medication_workflow_records')
        .select('prescription_id, scheduled_date')
        .eq('patient_id', patientId)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);

      if (!verifyError && allRecords) {
        console.warn(`資料庫中該院友在 ${yearMonth} 共有 ${allRecords.length} 條執核派記錄`);

        if (allRecords.length > 0) {
          const dbPrescriptionIds = [...new Set(allRecords.map(r => r.prescription_id))];
          console.warn('資料庫中的處方ID:', dbPrescriptionIds);
          console.warn('資料庫中的處方ID類型:', dbPrescriptionIds.map(id => `${id} (${typeof id})`));

          const missingInQuery = dbPrescriptionIds.filter(id => !uniquePrescriptionIds.includes(id));
          const missingInDb = uniquePrescriptionIds.filter(id => !dbPrescriptionIds.includes(id));

          if (missingInQuery.length > 0) {
            console.warn('❗ 資料庫中存在但查詢中遺漏的處方ID:', missingInQuery);
          }
          if (missingInDb.length > 0) {
            console.warn('❗ 查詢中包含但資料庫中不存在的處方ID:', missingInDb);
          }

          console.warn('採樣資料庫記錄 (前3條):', allRecords.slice(0, 3));
        }
      }
    } else {
      console.log('採樣查詢結果 (前3條):');
      data.slice(0, 3).forEach((record, idx) => {
        console.log(`  [${idx + 1}] 處方ID: ${record.prescription_id}, 日期: ${record.scheduled_date}, 時間: ${record.scheduled_time}`);
      });

      const recordPrescriptionIds = [...new Set(data.map(r => r.prescription_id))];
      console.log(`查詢結果包含 ${recordPrescriptionIds.length} 個不同的處方ID:`, recordPrescriptionIds);
    }
    console.log('========================================\n');

    return data || [];
  } catch (error) {
    console.error('❌ fetchWorkflowRecordsForMonth 發生錯誤:', error);
    console.error('錯誤堆疊:', error instanceof Error ? error.stack : '無堆疊資訊');
    return [];
  }
};

export const getWorkflowRecordForPrescriptionDateTimeSlot = (
  workflowRecords: WorkflowRecord[],
  prescriptionId: string,
  date: string,
  timeSlot: string
): WorkflowRecord | null => {
  // 標準化時間格式為 HH:MM
  const normalizeTime = (time: string): string => {
    if (!time) return '';
    return time.substring(0, 5); // 只取前5個字符 "HH:MM"
  };

  const normalizedTimeSlot = normalizeTime(timeSlot);

  console.log('[getWorkflowRecord] 查找條件:', {
    prescriptionId,
    date,
    timeSlot,
    normalizedTimeSlot,
    recordsCount: workflowRecords.length
  });

  const record = workflowRecords.find(
    r => {
      const matches =
        r.prescription_id === prescriptionId &&
        r.scheduled_date === date &&
        normalizeTime(r.scheduled_time) === normalizedTimeSlot;

      if (matches) {
        console.log('[getWorkflowRecord] 找到匹配記錄:', {
          recordId: r.id.substring(0, 8),
          prescription_id: r.prescription_id,
          scheduled_date: r.scheduled_date,
          scheduled_time: r.scheduled_time
        });
      }

      return matches;
    }
  );

  if (!record) {
    console.log('[getWorkflowRecord] 未找到記錄，檢查前3條記錄:',
      workflowRecords.slice(0, 3).map(r => ({
        prescription_id: r.prescription_id,
        scheduled_date: r.scheduled_date,
        scheduled_time: r.scheduled_time
      }))
    );
  }

  return record || null;
};

export const extractStaffNamesFromWorkflowRecords = (workflowRecords: WorkflowRecord[]): string[] => {
  const staffNames: string[] = [];
  let prepCount = 0, verifyCount = 0, dispenseCount = 0;
  let prepCompletedCount = 0, verifyCompletedCount = 0, dispenseCompletedCount = 0;

  workflowRecords.forEach(record => {
    if (record.preparation_staff) {
      prepCount++;
      if (record.preparation_status === 'completed') {
        prepCompletedCount++;
        staffNames.push(record.preparation_staff);
      }
    }
    if (record.verification_staff) {
      verifyCount++;
      if (record.verification_status === 'completed') {
        verifyCompletedCount++;
        staffNames.push(record.verification_staff);
      }
    }
    if (record.dispensing_staff) {
      dispenseCount++;
      if (record.dispensing_status === 'completed') {
        dispenseCompletedCount++;
        staffNames.push(record.dispensing_staff);
      }
    }
  });

  console.log('[extractStaffNamesFromWorkflowRecords] 統計:');
  console.log(`  執藥: ${prepCompletedCount}/${prepCount} 已完成`);
  console.log(`  核藥: ${verifyCompletedCount}/${verifyCount} 已完成`);
  console.log(`  派藥: ${dispenseCompletedCount}/${dispenseCount} 已完成`);
  console.log(`  提取到 ${staffNames.length} 個人員姓名 (含重複)`);

  return staffNames;
};

export const formatWorkflowCellContent = (
  workflowRecord: WorkflowRecord | null,
  staffCodeMapping: StaffCodeMapping
): string => {
  if (!workflowRecord) {
    return '';
  }

  // 檢查是否有失敗狀態，返回特殊代號
  if (workflowRecord.preparation_status === 'failed' ||
      workflowRecord.verification_status === 'failed' ||
      workflowRecord.dispensing_status === 'failed') {

    const reason = workflowRecord.dispensing_failure_reason;
    const customReason = workflowRecord.custom_failure_reason;

    // 處理所有特殊執行結果
    if (reason === '入院') return 'A';
    if (reason === '自理') return 'S';
    if (reason === '拒服') return 'R';
    if (reason === '暫停') return 'O';
    if (reason === '回家渡假') return 'HL';

    // 處理「其他」類別中的特殊情況
    if (reason === '其他') {
      if (customReason === '暫停') return 'O';
      if (customReason === '回家渡假') return 'HL';
      if (customReason === '自理') return 'S';
    }
  }

  const prepStaffName = workflowRecord.preparation_staff;
  const verifyStaffName = workflowRecord.verification_staff;

  const isPrepCompleted = workflowRecord.preparation_status === 'completed';
  const isVerifyCompleted = workflowRecord.verification_status === 'completed';

  const prepStaff = isPrepCompleted && prepStaffName
    ? staffCodeMapping[prepStaffName] || ''
    : '';

  const verifyStaff = isVerifyCompleted && verifyStaffName
    ? staffCodeMapping[verifyStaffName] || ''
    : '';

  const prepStaffInMapping = prepStaffName ? (prepStaffName in staffCodeMapping) : false;
  const verifyStaffInMapping = verifyStaffName ? (verifyStaffName in staffCodeMapping) : false;

  console.log('[formatWorkflowCellContent]', {
    recordId: workflowRecord.id.substring(0, 8),
    prepStatus: workflowRecord.preparation_status,
    verifyStatus: workflowRecord.verification_status,
    prepStaffOriginal: prepStaffName,
    verifyStaffOriginal: verifyStaffName,
    prepStaffInMapping: prepStaffInMapping,
    verifyStaffInMapping: verifyStaffInMapping,
    prepStaffCode: prepStaff,
    verifyStaffCode: verifyStaff,
    finalResult: prepStaff && verifyStaff ? `${prepStaff}  ${verifyStaff}` : (prepStaff || verifyStaff || '')
  });

  if (prepStaff && verifyStaff) {
    return `${prepStaff}  ${verifyStaff}`;
  } else if (prepStaff) {
    return prepStaff;
  } else if (verifyStaff) {
    return verifyStaff;
  }

  return '';
};

export const formatDispenseCellContent = (
  workflowRecord: WorkflowRecord | null,
  staffCodeMapping: StaffCodeMapping
): string => {
  if (!workflowRecord) {
    return '';
  }

  // 檢查派藥是否失敗，返回特殊代號
  if (workflowRecord.dispensing_status === 'failed') {
    const reason = workflowRecord.dispensing_failure_reason;
    const customReason = workflowRecord.custom_failure_reason;

    // 處理所有特殊執行結果
    if (reason === '入院') return 'A';
    if (reason === '自理') return 'S';
    if (reason === '拒服') return 'R';
    if (reason === '暫停') return 'O';
    if (reason === '回家渡假') return 'HL';

    // 處理「其他」類別中的特殊情況
    if (reason === '其他') {
      if (customReason === '暫停') return 'O';
      if (customReason === '回家渡假') return 'HL';
      if (customReason === '自理') return 'S';
    }
  }

  const dispenseStaffName = workflowRecord.dispensing_staff;
  const isDispenseCompleted = workflowRecord.dispensing_status === 'completed';

  const dispenseStaff = isDispenseCompleted && dispenseStaffName
    ? staffCodeMapping[dispenseStaffName] || ''
    : '';

  const dispenseStaffInMapping = dispenseStaffName ? (dispenseStaffName in staffCodeMapping) : false;

  console.log('[formatDispenseCellContent]', {
    recordId: workflowRecord.id.substring(0, 8),
    dispenseStatus: workflowRecord.dispensing_status,
    dispenseStaffOriginal: dispenseStaffName,
    dispenseStaffInMapping: dispenseStaffInMapping,
    dispenseStaffCode: dispenseStaff,
    finalResult: dispenseStaff
  });

  return dispenseStaff;
};
