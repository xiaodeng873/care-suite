-- ============================================================
-- Migration: 四項生命表徵任務合併為單一「生命表徵」任務
-- 2026-09-05
--
-- 改動概要：
--   1. health_task_type enum 加回「生命表徵」（20260627000002 曾將其移除）
--   2. 血壓/脈搏/血含氧量/呼吸 四種任務，按同院友、同排程、同備註、
--      同循環設定分組，每組合併為一條「生命表徵」任務：
--        - last_completed_at 取各組最大值（最近完成時間）
--        - next_due_at 取各組最小值（最早到期）
--   3. 刪除原有四項任務。
--      健康監測記錄.任務id 設有 ON DELETE SET NULL，
--      歷史記錄保留，且系統有 院友+監測類型 後備匹配，舊記錄不會失聯。
--   4. 體溫、血糖值、體重及其他任務類型完全不受影響。
-- 注意：監測「記錄」維持逐項（血壓一格、脈搏一格），本 migration 只動任務。
-- ============================================================

ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '生命表徵';

INSERT INTO patient_health_tasks (
  patient_id, facility_id, health_record_type,
  frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
)
SELECT
  patient_id, facility_id, '生命表徵'::health_task_type,
  frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  MAX(last_completed_at), MIN(next_due_at), notes, is_recurring,
  start_date, end_date, end_time
FROM patient_health_tasks
WHERE health_record_type::text IN ('血壓', '脈搏', '血含氧量', '呼吸')
GROUP BY
  patient_id, facility_id, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  notes, is_recurring, start_date, end_date, end_time;

DELETE FROM patient_health_tasks
WHERE health_record_type::text IN ('血壓', '脈搏', '血含氧量', '呼吸');

-- 驗證：四項任務應已清零
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM patient_health_tasks
    WHERE health_record_type::text IN ('血壓', '脈搏', '血含氧量', '呼吸')
  ) THEN
    RAISE EXCEPTION '合併驗證失敗：patient_health_tasks 仍存在未合併的逐項生命表徵任務';
  END IF;
END $$;
