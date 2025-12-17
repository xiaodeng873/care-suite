import { supabase } from '../lib/supabase';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config/supabase.config';

/**
 * 為指定日期和院友生成藥物工作流程記錄
 */
export async function generateDailyWorkflowRecords(
  targetDate: string,
  patientId?: number
): Promise<{ success: boolean; message: string; recordsGenerated: number }> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      message: 'Supabase 環境變數未設定',
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

    console.log('發送請求到:', `${functionUrl}?${params.toString()}`);
    
    const response = await fetch(`${functionUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
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

    console.log(`\n====== 批量生成工作流程記錄 ======`);
    console.log(`日期範圍: ${startDate} 至 ${endDate}`);
    console.log(`院友ID: ${patientId || '全部'}`);

    // 逐日生成記錄
    let currentDate = new Date(start);
    let dayCount = 0;

    while (currentDate <= end) {
      const dateString = currentDate.toISOString().split('T')[0];
      dayCount++;

      console.log(`\n[${dayCount}] 正在生成 ${dateString} 的記錄...`);

      const result = await generateDailyWorkflowRecords(dateString, patientId);

      if (result.success) {
        totalRecords += result.recordsGenerated;
        console.log(`✓ ${dateString}: 成功生成 ${result.recordsGenerated} 筆記錄`);
      } else {
        failedDates.push(dateString);
        console.error(`✗ ${dateString}: 生成失敗 - ${result.message}`);
      }

      // 移動到下一天
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`\n====== 批量生成完成 ======`);
    console.log(`成功生成記錄總數: ${totalRecords}`);
    console.log(`處理日期數: ${dayCount}`);
    console.log(`失敗日期數: ${failedDates.length}`);
    if (failedDates.length > 0) {
      console.log(`失敗的日期:`, failedDates);
    }
    console.log(`===========================\n`);

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