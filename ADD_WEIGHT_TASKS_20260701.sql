-- 為所有在住院友新增體重監測任務
-- 開始日期：2026-07-01，每月 1 次，備註「定期」
-- 已有任何體重任務的院友跳過，確保每人只有一個

INSERT INTO patient_health_tasks (
  patient_id,
  health_record_type,
  frequency_unit,
  frequency_value,
  start_date,
  notes,
  next_due_at,
  is_recurring
)
SELECT
  院友id,
  '體重'::health_task_type,
  'monthly',
  1,
  '2026-07-01',
  '定期',
  '2026-07-01 00:00:00+00',  -- 2026-07-01 08:00 HKT
  true
FROM 院友主表
WHERE 在住狀態 = '在住'
  AND 院友id NOT IN (
    SELECT patient_id
    FROM patient_health_tasks
    WHERE health_record_type = '體重'::health_task_type
  );
-- 注意：'體重控制' 是前端向後相容用的假類型，在 DB enum health_task_type 中不存在，
--       勿在此 SQL 引用，以免 enum cast error。

-- 確認插入數量
SELECT COUNT(*) AS "新增體重任務數"
FROM patient_health_tasks
WHERE health_record_type = '體重'
  AND notes = '定期'
  AND start_date = '2026-07-01';
