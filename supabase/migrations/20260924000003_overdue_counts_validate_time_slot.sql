/*
  # 逾期藥物工作流程統計 RPC：加入時間點仍存在驗證

  1. 背景
    - 處方改咗 medication_time_slots 之後，舊時間點嘅 pending 記錄可能殘留
      （edge function 清理係登入觸發，未必即時跑），Dashboard 會誤報逾期。
    - 原 RPC（20260830110000_add_overdue_workflow_counts_rpc.sql）只驗日期範圍，
      唔驗證 scheduled_time 仲存唔存在於處方當前時間點。

  2. 今次改動（唯一差異）
    - overdue_valid 加一條：處方有時間點時，scheduled_time（normalize 到 HH:MM）
      必須存在於 p.medication_time_slots（jsonb array，slot 值截頭 5 字元比較）。
    - 處方冇時間點（NULL 或空 array，即 PRN）就唔用呢條過濾，維持原行為。
    - 其他條件（status、is_prn、start/end 日期時間範圍、孤兒記錄）全部不變。

  3. 業務規則備注
    - 舊 migration 20260725015026_clean_workflow_records_past_end_time.sql 嘅註解
      話「停服時間點後有簽署都要刪除」——呢個規則已廢除：已簽記錄永不刪除，
      只有純 pending 記錄（排程預告）先可以清理。該檔已 apply，唔再修改，
      特此注明以免誤讀。
*/

CREATE OR REPLACE FUNCTION public.get_overdue_workflow_counts()
RETURNS TABLE(patient_id integer, overdue_count bigint, earliest_date date, dates jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH hk_now AS (
    SELECT now() AT TIME ZONE 'Asia/Hong_Kong' AS ts
  ),
  base AS (
    SELECT
      r.patient_id,
      r.scheduled_date,
      r.scheduled_time,
      r.prescription_id,
      r.preparation_status,
      r.verification_status,
      r.dispensing_status,
      ((r.scheduled_date::timestamp + r.scheduled_time) < (SELECT ts FROM hk_now)) AS is_overdue_time
    FROM medication_workflow_records r
    WHERE r.scheduled_date <= ((SELECT ts FROM hk_now)::date)
      AND (r.preparation_status = 'pending'
           OR r.verification_status = 'pending'
           OR r.dispensing_status = 'pending')
  ),
  judged AS (
    SELECT
      b.*,
      (
        b.dispensing_status = 'pending'
        AND b.is_overdue_time
        AND p.id IS NOT NULL
        AND p.status <> 'pending_change'
        AND NOT (p.is_prn AND (p.medication_time_slots IS NULL OR jsonb_array_length(p.medication_time_slots) = 0))
        AND NOT (p.status <> 'active' AND p.end_date IS NULL)
        AND (p.start_date IS NULL OR b.scheduled_date > p.start_date
             OR (b.scheduled_date = p.start_date AND b.scheduled_time >= COALESCE(p.start_time, '00:00'::time)))
        AND (p.end_date IS NULL OR b.scheduled_date < p.end_date
             OR (b.scheduled_date = p.end_date AND b.scheduled_time <= COALESCE(p.end_time, '00:00'::time)))
        -- 新增：時間點已喺處方移除嘅記錄唔計逾期（冇時間點＝PRN 唔過濾）
        AND (
          p.medication_time_slots IS NULL
          OR jsonb_array_length(p.medication_time_slots) = 0
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(p.medication_time_slots) AS slot(slot_value)
            WHERE left(slot.slot_value, 5) = left(b.scheduled_time::text, 5)
          )
        )
      ) AS overdue_valid
    FROM base b
    LEFT JOIN new_medication_prescriptions p ON p.id = b.prescription_id
  ),
  per_date AS (
    SELECT
      judged.patient_id,
      judged.scheduled_date,
      count(*) FILTER (WHERE overdue_valid) AS overdue_cnt,
      count(*) AS any_pending_cnt
    FROM judged
    GROUP BY judged.patient_id, judged.scheduled_date
    HAVING count(*) FILTER (WHERE overdue_valid) > 0
  )
  SELECT
    per_date.patient_id,
    sum(per_date.overdue_cnt) AS overdue_count,
    min(per_date.scheduled_date) AS earliest_date,
    jsonb_object_agg(per_date.scheduled_date::text, per_date.any_pending_cnt) AS dates
  FROM per_date
  GROUP BY per_date.patient_id;
$$;
