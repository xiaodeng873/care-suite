/*
  # 逾期藥物工作流程統計 RPC

  1. 目的
    - Dashboard 逾期提醒卡原本要全量下載約 6 萬筆 medication_workflow_records 落 client 計算，
      造成啟動查詢風暴同 statement timeout。
    - 改由 server 端聚合，每院友一行：總逾期數、最早逾期日、每逾期日嘅 pending 數（jsonb）。

  2. 邏輯（對應 client workflowStatusHelper.ts）
    - 逾期：dispensing_status = 'pending' 且排程日期時間已過（香港時區）
    - 排除：孤兒記錄（處方已刪）、pending_change 處方、已過處方有效時點、無時間點 PRN
    - dates：只包含有逾期記錄嘅日期；值為該日三階段任何一個 pending 嘅記錄數（對應 Dashboard 日期格計數）
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
