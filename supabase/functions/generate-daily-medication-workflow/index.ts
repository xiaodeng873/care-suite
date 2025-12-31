import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const targetDate = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const patientId = url.searchParams.get('patient_id');


    let prescriptionQuery = supabase
      .from('new_medication_prescriptions')
      .select('*')
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

        // 刪除該處方在結束日期之後的所有工作流程記錄
        const nextDay = new Date(new Date(endDateStr).getTime() + 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];

        const { error: deleteError } = await supabase
          .from('medication_workflow_records')
          .delete()
          .eq('prescription_id', prescription.id)
          .gte('scheduled_date', nextDay);

        if (deleteError) {
          console.error(`刪除過期工作流程記錄失敗: ${deleteError.message}`);
        } else {
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

      // 清理該處方所有超出時間範圍的工作流程記錄

      // 標準化時間格式
      const normalizeTime = (time: string | null | undefined): string => {
        if (!time) return '00:00';
        return time.substring(0, 5);
      };

      const startTime = normalizeTime(prescription.start_time) || '00:00';
      const endTime = normalizeTime(prescription.end_time) || '23:59';

      // 查詢該處方的所有工作流程記錄
      const { data: existingRecords, error: fetchError } = await supabase
        .from('medication_workflow_records')
        .select('id, scheduled_date, scheduled_time')
        .eq('prescription_id', prescription.id);

      if (!fetchError && existingRecords) {
        const recordsToDelete: string[] = [];

        for (const record of existingRecords) {
          const recordDate = record.scheduled_date;
          const recordTime = normalizeTime(record.scheduled_time);

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
            const effectiveEndTime = prescription.end_time ? normalizeTime(prescription.end_time) : '23:59';
            if (recordTime > effectiveEndTime) {
              shouldDelete = true;
            }
          }

          if (shouldDelete) {
            recordsToDelete.push(record.id);
          }
        }

        if (recordsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('medication_workflow_records')
            .delete()
            .in('id', recordsToDelete);

          if (deleteError) {
            console.error(`刪除超出範圍記錄失敗: ${deleteError.message}`);
          } else {
          }
        } else {
        }
      }

    }


    let actualInsertedCount = 0;
    if (workflowRecords.length > 0) {
      const { data: insertedRecords, error: insertError } = await supabase
        .from('medication_workflow_records')
        .upsert(workflowRecords, {
          onConflict: 'prescription_id,scheduled_date,scheduled_time',
          ignoreDuplicates: true
        })
        .select();

      if (insertError) {
        console.error(`插入工作流程記錄時發生錯誤: ${insertError.message}`);

        for (const record of workflowRecords) {
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
        actualInsertedCount = insertedRecords?.length || 0;
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

function checkMedicationSchedule(prescription: Prescription, targetDate: Date): boolean {
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
      const shouldTake = daysDiff % interval === 0;
      return shouldTake;

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
      const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
                        (targetDate.getMonth() - startDate.getMonth());
      const monthInterval = frequency_value || 1;
      const monthResult = monthsDiff % monthInterval === 0 &&
             targetDate.getDate() === startDate.getDate();
      return monthResult;

    default:
      return true;
  }
}
