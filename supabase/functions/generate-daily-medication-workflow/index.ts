import { createClient } from 'npm:@supabase/supabase-js@2';
import { isPrescriptionScheduledOnDate } from '../_shared/prescriptionSchedule.ts';

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


    // 生成新記錄只限 active 處方（inactive / pending_change 唔應該生成新記錄）
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

    // 清理範圍擴大到 active + inactive（inactive 處方嘅殘留 pending 記錄都要清）；
    // pending_change 處方本來唔入 eMAR，唔使理
    let cleanupQuery = supabase
      .from('new_medication_prescriptions')
      .select('*')
      .in('status', ['active', 'inactive']);

    if (patientId) {
      cleanupQuery = cleanupQuery.eq('patient_id', parseInt(patientId));
    }

    const { data: cleanupPrescriptions, error: cleanupQueryError } = await cleanupQuery;

    if (cleanupQueryError) {
      throw new Error(`查詢清理範圍處方失敗: ${cleanupQueryError.message}`);
    }


    const workflowRecords: WorkflowRecord[] = [];

    // 一次性批量攞晒清理範圍處方嘅現有工作流程記錄（分 chunk 查，每 chunk 100 個處方、每頁 5000 行）
    // 舊版逐個處方各查一次（N+1 查詢），處方一多就超時/資源爆
    const normalizeTimeGlobal = (time: string | null | undefined): string => {
      if (!time) return '00:00';
      return time.substring(0, 5);
    };

    const cleanupPrescriptionIds = (cleanupPrescriptions || []).map((p: any) => p.id);
    const existingByPrescription = new Map<string, {
      id: string;
      scheduled_date: string;
      scheduled_time: string;
      preparation_status: string;
      verification_status: string;
      dispensing_status: string;
    }[]>();
    if (cleanupPrescriptionIds.length > 0) {
      const ID_CHUNK = 100;
      for (let i = 0; i < cleanupPrescriptionIds.length; i += ID_CHUNK) {
        const chunk = cleanupPrescriptionIds.slice(i, i + ID_CHUNK);
        let from = 0;
        for (;;) {
          const { data, error: fetchAllError } = await supabase
            .from('medication_workflow_records')
            .select('id, prescription_id, scheduled_date, scheduled_time, preparation_status, verification_status, dispensing_status')
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

    // 需要刪除嘅記錄 id（唔再符合當前處方規則嘅純 pending 記錄），最後一次過分批刪
    const recordsToDelete: string[] = [];


    for (const prescription of prescriptions || []) {

      const targetDateStr = targetDate;
      const startDateStr = prescription.start_date;
      const endDateStr = prescription.end_date;

      // 服藥日判斷同前端 apps/web/src/utils/prescriptionSchedule.ts 一致
      //（包括 start/end 邊界；早於開始日或遲於結束日直接唔係服藥日）
      const shouldTakeMedication = isPrescriptionScheduledOnDate(prescription, targetDate);

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

    }

    // ── 清理段 ─────────────────────────────────────────────────
    // 業務規則：已簽記錄永不刪除（preparation/verification/dispensing 任一非 pending 即已簽）；
    // 純 pending 記錄係排程預告，唔再符合當前處方規則就可以清。
    // 刪除條件（OR，符合任何一條即刪）：
    //   1. 範圍外：scheduled_date < start_date；start_date 當日早過 start_time；
    //      > end_date；或 end_date 當日遲過 end_time（原有範圍規則）
    //   2. 時間點已移除：scheduled_time 唔再喺處方當前 medication_time_slots 入面
    //     （處方冇時間點＝PRN 就唔用呢條）
    //   3. 該日喺當前頻率規則下唔係服藥日（同前端 prescriptionSchedule.ts 一致）
    for (const prescription of cleanupPrescriptions || []) {

      const startDateStr = prescription.start_date;
      const endDateStr = prescription.end_date;
      const startTime = normalizeTimeGlobal(prescription.start_time) || '00:00';
      const currentSlots = (prescription.medication_time_slots || [])
        .map((slot: string) => normalizeTimeGlobal(slot));

      const existingRecords = existingByPrescription.get(prescription.id) || [];
      for (const record of existingRecords) {
        // 已簽記錄永不刪
        if (record.preparation_status !== 'pending'
          || record.verification_status !== 'pending'
          || record.dispensing_status !== 'pending') {
          continue;
        }

        const recordDate = record.scheduled_date;
        const recordTime = normalizeTimeGlobal(record.scheduled_time);

        let shouldDelete = false;

        // 1. 範圍外
        if (recordDate < startDateStr) {
          shouldDelete = true;
        } else if (recordDate === startDateStr && recordTime < startTime) {
          shouldDelete = true;
        } else if (endDateStr && recordDate > endDateStr) {
          shouldDelete = true;
        } else if (endDateStr && recordDate === endDateStr) {
          const effectiveEndTime = prescription.end_time ? normalizeTimeGlobal(prescription.end_time) : '23:59';
          if (recordTime > effectiveEndTime) {
            shouldDelete = true;
          }
        }

        // 2. 時間點已移除（PRN／冇時間點嘅處方唔用呢條）
        if (!shouldDelete && currentSlots.length > 0 && !currentSlots.includes(recordTime)) {
          shouldDelete = true;
        }

        // 3. 該日唔再係服藥日（頻率改咗後殘留嘅 pending 記錄）
        if (!shouldDelete && !isPrescriptionScheduledOnDate(prescription, recordDate)) {
          shouldDelete = true;
        }

        if (shouldDelete) {
          recordsToDelete.push(record.id);
        }
      }
    }

    // 一次過分批刪除所有唔再符合規則嘅純 pending 記錄（每批 500 個 id）
    if (recordsToDelete.length > 0) {
      const DELETE_CHUNK = 500;
      for (let i = 0; i < recordsToDelete.length; i += DELETE_CHUNK) {
        const chunk = recordsToDelete.slice(i, i + DELETE_CHUNK);
        const { error: deleteError } = await supabase
          .from('medication_workflow_records')
          .delete()
          .in('id', chunk);

        if (deleteError) {
          console.error(`批量刪除過時 pending 記錄失敗: ${deleteError.message}`);
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
        recordsDeleted: recordsToDelete.length,
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
