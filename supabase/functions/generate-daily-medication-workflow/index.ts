import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Db-Token",
};

interface Prescription {
  id: string;
  patient_id: number;
  medication_name: string;
  frequency_type: string;
  frequency_value: number;
  specific_weekdays: number[];
  is_odd_even_day: string;
  medication_time_slots: string[];
  start_date: string;
  end_date?: string;
  last_taken_date?: string;
  status: string;
}

interface WorkflowRecord {
  patient_id: number;
  prescription_id: string;
  scheduled_date: string;
  scheduled_time: string;
  preparation_status: 'pending';
  verification_status: 'pending';
  dispensing_status: 'pending';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 必須帶上用戶本人的 dbToken，以用戶身份執行，RLS tenant 隔離才生效
    // 沒有 dbToken 一律拒絕（fail closed），不得用 service role 繞過院舍隔離
    const dbToken = req.headers.get('X-Db-Token');
    if (!dbToken) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權：缺少 X-Db-Token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${dbToken}` } },
      realtime: { enabled: false },
    });

    const url = new URL(req.url);
    const targetDate = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const patientId = url.searchParams.get('patient_id');


    let prescriptionQuery = supabase
      .from('new_medication_prescriptions')
      .select('*')
      .eq('status', 'active')
      .lte('start_date', targetDate);

    if (patientId) {
      prescriptionQuery = prescriptionQuery.eq('patient_id', parseInt(patientId));
    }

    const { data: prescriptions, error: prescriptionError } = await prescriptionQuery;

    if (prescriptionError) {
      throw new Error(`查詢處方失敗: ${prescriptionError.message}`);
    }


    const workflowRecords: WorkflowRecord[] = [];
    const [year, month, day] = targetDate.split('-').map(Number);
    const targetDateObj = new Date(year, month - 1, day);

    // 一次性批量攞晒所有活躍處方嘅現有工作流程記錄（分 chunk 查，每 chunk 100 個處方、每頁 5000 行）
    // 舊版逐個處方各查一次（N+1 查詢），處方一多就超時/資源爆
    const normalizeTimeGlobal = (time: string | null | undefined): string => {
      if (!time) return '00:00';
      return time.substring(0, 5);
    };

    const prescriptionIds = (prescriptions || []).map((p: any) => p.id);
    const existingByPrescription = new Map<string, { id: string; scheduled_date: string; scheduled_time: string }[]>();
    if (prescriptionIds.length > 0) {
      const ID_CHUNK = 100;
      for (let i = 0; i < prescriptionIds.length; i += ID_CHUNK) {
        const chunk = prescriptionIds.slice(i, i + ID_CHUNK);
        let from = 0;
        for (;;) {
          const { data, error: fetchAllError } = await supabase
            .from('medication_workflow_records')
            .select('id, prescription_id, scheduled_date, scheduled_time')
            .in('prescription_id', chunk)
            .range(from, from + 4999);
          if (fetchAllError) {
            console.error(`批量查詢工作流程記錄失敗: ${fetchAllError.message}`);
            break;
          }
          for (const r of data || []) {
            const list = existingByPrescription.get(r.prescription_id) || [];
            list.push(r);
            existingByPrescription.set(r.prescription_id, list);
          }
          if (!data || data.length < 5000) break;
          from += 5000;
        }
      }
    }

    // 需要刪除嘅記錄 id（離開處方有效範圍／過期處方），最後一次過分批刪
    const recordsToDelete: string[] = [];


    for (const prescription of prescriptions || []) {

      const [startYear, startMonth, startDay] = prescription.start_date.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay);

      let endDate: Date | null = null;
      if (prescription.end_date) {
        const [endYear, endMonth, endDay] = prescription.end_date.split('-').map(Number);
        endDate = new Date(endYear, endMonth - 1, endDay);
      }


      const targetDateStr = targetDate;
      const startDateStr = prescription.start_date;
      const endDateStr = prescription.end_date;


      if (targetDateStr < startDateStr) {
        continue;
      }

      // 處方結束日期包含整天（直到23:59:59），只有在結束日期之後才算過期
      if (endDateStr && targetDateStr > endDateStr) {

        // 收集該處方在結束日期之後的所有工作流程記錄（最後統一批量刪）
        const nextDay = new Date(new Date(endDateStr).getTime() + 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];

        for (const record of existingByPrescription.get(prescription.id) || []) {
          if (record.scheduled_date >= nextDay) {
            recordsToDelete.push(record.id);
          }
        }

        continue;
      }


      const shouldTakeMedication = checkMedicationSchedule(prescription, targetDateObj);

      if (!shouldTakeMedication) {
        continue;
      }

      const timeSlots = prescription.medication_time_slots || [];

      if (timeSlots.length === 0) {
        continue;
      }

      for (const timeSlot of timeSlots) {

        // 標準化時間格式為 HH:MM（移除秒數）
        const normalizeTime = (time: string | null | undefined): string => {
          if (!time) return '00:00';
          return time.substring(0, 5); // 取前5個字元 "HH:MM"
        };

        // 檢查時間點是否在處方有效時間範圍內
        const startTime = normalizeTime(prescription.start_time) || '00:00';
        const endTime = normalizeTime(prescription.end_time) || '23:59';
        const normalizedTimeSlot = normalizeTime(timeSlot);


        // 如果是開始日期當天，檢查時間點是否 >= 開始時間
        if (targetDateStr === startDateStr && normalizedTimeSlot < startTime) {
          continue;
        }

        // 如果是結束日期當天，結束時間若未設定則視為23:59，允許整天的所有時間點
        if (endDateStr && targetDateStr === endDateStr) {
          const effectiveEndTime = prescription.end_time ? normalizeTime(prescription.end_time) : '23:59';
          if (normalizedTimeSlot > effectiveEndTime) {
            continue;
          }
        }

        workflowRecords.push({
          patient_id: prescription.patient_id,
          prescription_id: prescription.id,
          scheduled_date: targetDate,
          scheduled_time: timeSlot,
          preparation_status: 'pending',
          verification_status: 'pending',
          dispensing_status: 'pending'
        });
      }

      // 清理該處方所有超出時間範圍的工作流程記錄（用上面批量攞嘅記錄，唔再逐個處方查）

      const startTime = normalizeTimeGlobal(prescription.start_time) || '00:00';

      const existingRecords = existingByPrescription.get(prescription.id) || [];
      {
        for (const record of existingRecords) {
          const recordDate = record.scheduled_date;
          const recordTime = normalizeTimeGlobal(record.scheduled_time);

          let shouldDelete = false;

          // 檢查是否在開始日期之前
          if (recordDate < startDateStr) {
            shouldDelete = true;
          }
          // 檢查開始日期當天的時間
          else if (recordDate === startDateStr && recordTime < startTime) {
            shouldDelete = true;
          }
          // 檢查是否在結束日期之後
          else if (endDateStr && recordDate > endDateStr) {
            shouldDelete = true;
          }
          // 檢查結束日期當天的時間（結束時間若未設定則視為23:59）
          else if (endDateStr && recordDate === endDateStr) {
            const effectiveEndTime = prescription.end_time ? normalizeTimeGlobal(prescription.end_time) : '23:59';
            if (recordTime > effectiveEndTime) {
              shouldDelete = true;
            }
          }

          if (shouldDelete) {
            recordsToDelete.push(record.id);
          }
        }
      }

    }

    // 一次過分批刪除所有超出範圍嘅記錄（每批 500 個 id）
    if (recordsToDelete.length > 0) {
      const DELETE_CHUNK = 500;
      for (let i = 0; i < recordsToDelete.length; i += DELETE_CHUNK) {
        const chunk = recordsToDelete.slice(i, i + DELETE_CHUNK);
        const { error: deleteError } = await supabase
          .from('medication_workflow_records')
          .delete()
          .in('id', chunk);

        if (deleteError) {
          console.error(`批量刪除超出範圍記錄失敗: ${deleteError.message}`);
        }
      }
    }


    let actualInsertedCount = 0;
    if (workflowRecords.length > 0) {
      // 分批 upsert（每批 500 行），一批失敗先逐筆補插嗰批
      const UPSERT_CHUNK = 500;
      for (let i = 0; i < workflowRecords.length; i += UPSERT_CHUNK) {
        const batch = workflowRecords.slice(i, i + UPSERT_CHUNK);
        const { data: insertedRecords, error: insertError } = await supabase
          .from('medication_workflow_records')
          .upsert(batch, {
            onConflict: 'prescription_id,scheduled_date,scheduled_time',
            ignoreDuplicates: true
          })
          .select();

        if (insertError) {
          console.error(`插入工作流程記錄時發生錯誤: ${insertError.message}`);

          for (const record of batch) {
            const { error: singleInsertError } = await supabase
              .from('medication_workflow_records')
              .insert(record);

            if (!singleInsertError) {
              actualInsertedCount++;
            } else if (singleInsertError.code === '23505') {
            } else {
              console.error(`  插入記錄失敗:`, singleInsertError);
            }
          }
        } else {
          actualInsertedCount += insertedRecords?.length || 0;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `成功為 ${targetDate} 生成 ${actualInsertedCount} 筆藥物工作流程記錄`,
        date: targetDate,
        recordsGenerated: actualInsertedCount,
        recordsAttempted: workflowRecords.length,
        prescriptionsProcessed: prescriptions?.length || 0
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    );

  } catch (error) {
    console.error('生成藥物工作流程記錄失敗:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    );
  }
});

// 間隔型頻率（隔X日/隔X星期/隔X月）的週期錨點：
// 目標日 ≥ 上次服用日 → 以上次服用日重定週期；否則沿用開始日期（與前端 prescriptionSchedule.ts 一致）
function pickIntervalAnchor(prescription: Prescription, startDate: Date, targetDate: Date): Date {
  if (!prescription.last_taken_date) return startDate;
  const [y, m, d] = prescription.last_taken_date.split('-').map(Number);
  const lastTaken = new Date(y, m - 1, d);
  if (lastTaken < startDate) return startDate;
  return targetDate >= lastTaken ? lastTaken : startDate;
}

function checkMedicationSchedule(prescription: Prescription, targetDate: Date): boolean {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day } = prescription;
  const startDate = new Date(prescription.start_date);


  switch (frequency_type) {
    case 'daily':
      return true;

    case 'every_x_days':
      const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const anchorDays = pickIntervalAnchor(prescription, new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()), targetDateOnly);
      const daysDiff = Math.floor((targetDateOnly.getTime() - anchorDays.getTime()) / (1000 * 60 * 60 * 24));
      // 「間隔X日」：frequency_value=N 表示跳過 N 天 → 週期 = N+1
      const interval = (frequency_value || 1) + 1;
      const shouldTake = daysDiff >= 0 && daysDiff % interval === 0;
      return shouldTake;

    case 'every_x_weeks':
      const targetDateOnlyW = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const anchorWeeks = pickIntervalAnchor(prescription, new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()), targetDateOnlyW);
      const daysDiffW = Math.floor((targetDateOnlyW.getTime() - anchorWeeks.getTime()) / (1000 * 60 * 60 * 24));
      // 「間隔X星期」：frequency_value=N 表示跳過 N 星期 → 週期 = (N+1)×7 天
      const intervalW = ((frequency_value || 1) + 1) * 7;
      return daysDiffW >= 0 && daysDiffW % intervalW === 0;

    case 'weekly_days':
      const dayOfWeek = targetDate.getDay();
      const targetDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      const result = specific_weekdays?.includes(targetDay) || false;
      return result;

    case 'odd_even_days':
      const dateNumber = targetDate.getDate();
      let oddEvenResult = false;
      if (is_odd_even_day === 'odd') {
        oddEvenResult = dateNumber % 2 === 1;
      } else if (is_odd_even_day === 'even') {
        oddEvenResult = dateNumber % 2 === 0;
      } else {
      }
      return oddEvenResult;

    case 'every_x_months':
      const anchorMonths = pickIntervalAnchor(prescription, startDate, targetDate);
      const monthsDiff = (targetDate.getFullYear() - anchorMonths.getFullYear()) * 12 +
                        (targetDate.getMonth() - anchorMonths.getMonth());
      const monthInterval = (frequency_value || 1) + 1; // 間隔X月 = 週期 X+1 月
      const monthResult = monthsDiff >= 0 && monthsDiff % monthInterval === 0 &&
             targetDate.getDate() === anchorMonths.getDate();
      return monthResult;

    default:
      return true;
  }
}
