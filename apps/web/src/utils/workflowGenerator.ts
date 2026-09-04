import { supabase } from '../lib/supabase';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config/supabase.config';
import { isPrescriptionScheduledOnDate } from './prescriptionSchedule';
import { SYNC_CUTOFF_DATE_STR } from '../lib/database';

/**
 * 前端批次生成工作流程記錄（單次 upsert，取代逐日多次 Edge Function HTTP 呼叫）。
 * 使用統一的 isPrescriptionScheduledOnDate 排程邏輯，只新增缺漏的服藥日記錄，
 * 以 (prescription_id, scheduled_date, scheduled_time) 為衝突鍵、ignoreDuplicates，
 * 因此冪等、可安全重複執行、且不會覆蓋已處理的記錄。
 */
export async function generateWorkflowRecordsClient(
  patientId: number,
  prescriptions: any[],
  fromDate: string,
  toDate: string
): Promise<{ inserted: number }> {
  const normalizeTime = (t: any): string => (t ? String(t).substring(0, 5) : '');
  const fmt = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // 起點不早於同步分界日（避免回補遠古歷史）
  const effectiveFrom = fromDate < SYNC_CUTOFF_DATE_STR ? SYNC_CUTOFF_DATE_STR : fromDate;

  const active = (prescriptions || []).filter(
    p => Number(p.patient_id) === Number(patientId) && p.status === 'active'
  );

  const records: any[] = [];
  for (const p of active) {
    const slots: string[] = Array.isArray(p.medication_time_slots) && p.medication_time_slots.length
      ? p.medication_time_slots
      : [];
    if (slots.length === 0) continue;

    const startStr: string = p.start_date;
    if (!startStr) continue;
    const startTime = normalizeTime(p.start_time) || '00:00';
    const endTime = normalizeTime(p.end_time) || '23:59';

    // 逐日掃描 [max(from, start) .. min(to, end)]
    const scanStart = effectiveFrom > startStr ? effectiveFrom : startStr;
    let d = new Date(scanStart + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    for (; d <= end; d.setDate(d.getDate() + 1)) {
      const ds = fmt(d);
      if (p.end_date && ds > p.end_date) break;
      if (!isPrescriptionScheduledOnDate(p, ds)) continue;
      for (const slot of slots) {
        const sl = normalizeTime(slot);
        if (!sl) continue;
        if (ds === startStr && sl < startTime) continue;
        if (p.end_date && ds === p.end_date && sl > endTime) continue;
        records.push({
          patient_id: patientId,
          prescription_id: p.id,
          scheduled_date: ds,
          scheduled_time: sl,
          preparation_status: 'pending',
          verification_status: 'pending',
          dispensing_status: 'pending',
        });
      }
    }
  }

  if (records.length === 0) return { inserted: 0 };

  const { data, error } = await supabase
    .from('medication_workflow_records')
    .upsert(records, {
      onConflict: 'prescription_id,scheduled_date,scheduled_time',
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    console.error('前端批次生成工作流程失敗:', error);
    throw error;
  }
  return { inserted: data?.length || 0 };
}

/**
 * 為指定日期和院友生成藥物工作流程記錄
 */
export async function generateDailyWorkflowRecords(
  targetDate: string,
  patientId?: number
): Promise<{ success: boolean; message: string; recordsGenerated: number }> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  // dbToken 未簽發完成前（登入競態視窗）直接跳過：edge function 無 token 會 401，
  // 呢個係背景同步，下一個觸發點會再補
  const dbToken = localStorage.getItem('care_suite_db_token');
  if (!supabaseUrl || !supabaseAnonKey || !dbToken) {
    return {
      success: false,
      message: '資料庫連線設定未就緒',
      recordsGenerated: 0
    };
  }
  try {
    const functionUrl = `${supabaseUrl}/functions/v1/generate-daily-medication-workflow`;
    const params = new URLSearchParams();
    params.append('date', targetDate);
    if (patientId) {
      params.append('patient_id', patientId.toString());
    }
    const response = await fetch(`${functionUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'X-Db-Token': dbToken,
      },
    }).catch(fetchError => {
      console.error('Fetch 請求失敗:', fetchError);
      throw new Error(`網路請求失敗: ${fetchError.message}`);
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP 錯誤回應:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '生成工作流程記錄失敗');
    }
    return {
      success: true,
      message: result.message,
      recordsGenerated: result.recordsGenerated || 0
    };
  } catch (error) {
    console.error('生成每日工作流程記錄失敗:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '網路連線或伺服器錯誤',
      recordsGenerated: 0
    };
  }
}
/**
 * 為未來幾天批量生成工作流程記錄
 */
export async function generateBatchWorkflowRecords(
  startDate: string,
  endDate: string,
  patientId?: number
): Promise<{ success: boolean; message: string; totalRecords: number; failedDates: string[] }> {
  try {
    let totalRecords = 0;
    const failedDates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    // 逐日生成記錄
    let currentDate = new Date(start);
    let dayCount = 0;
    while (currentDate <= end) {
      const dateString = currentDate.toISOString().split('T')[0];
      dayCount++;
      const result = await generateDailyWorkflowRecords(dateString, patientId);
      if (result.success) {
        totalRecords += result.recordsGenerated;
      } else {
        failedDates.push(dateString);
        console.error(`✗ ${dateString}: 生成失敗 - ${result.message}`);
      }
      // 移動到下一天
      currentDate.setDate(currentDate.getDate() + 1);
    }
    if (failedDates.length > 0) {
    }
    const hasFailures = failedDates.length > 0;
    const message = hasFailures
      ? `部分完成：生成 ${totalRecords} 筆記錄，${failedDates.length} 天失敗`
      : `成功為 ${startDate} 至 ${endDate} 生成 ${totalRecords} 筆工作流程記錄`;
    return {
      success: !hasFailures,
      message,
      totalRecords,
      failedDates
    };
  } catch (error) {
    console.error('批量生成工作流程記錄失敗:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '網路連線或伺服器錯誤',
      totalRecords: 0,
      failedDates: []
    };
  }
}