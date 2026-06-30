-- 劃一「在住院友」體溫任務：每天 1 次、時間點 08:00、備註「定期」
--
-- 規則：
--   1) 在住院友若已有體溫任務，但周期/時間點/備註不符（非 daily×1、非 ["08:00"]、非「定期」），則刪除。
--   2) 在住院友若缺少正確的體溫任務，則新增 daily×1、08:00、備註「定期」。
--
-- 設計：以 IS NOT DISTINCT FROM 處理可為 NULL 的欄位（specific_times / notes），
--       使腳本具 NULL 安全且可重複執行（idempotent）。
--
-- 注意：此腳本含 DELETE，屬不可逆操作，請先在 staging 驗證或已備份後執行。
-- 以單一交易包裹，確保「刪除 + 重寫」原子性。

BEGIN;

-- 步驟 1：刪除在住院友中周期/時間點/備註不符的體溫任務
DELETE FROM patient_health_tasks t
USING 院友主表 p
WHERE t.patient_id = p.院友id
  AND p.在住狀態 = '在住'
  AND t.health_record_type = '體溫'
  AND NOT (
        t.frequency_unit = 'daily'
    AND t.frequency_value = 1
    AND t.specific_times IS NOT DISTINCT FROM '["08:00"]'::jsonb
    AND t.notes IS NOT DISTINCT FROM '定期'::monitoring_task_notes
  );

-- 步驟 2：為仍缺少正確體溫任務的在住院友新增（daily×1、08:00、備註「定期」）
INSERT INTO patient_health_tasks
  (patient_id, health_record_type, frequency_unit, frequency_value,
   specific_times, is_recurring, notes, start_date, next_due_at)
SELECT
  p.院友id,
  '體溫',
  'daily',
  1,
  '["08:00"]'::jsonb,
  true,
  '定期',
  -- start_date：香港今天 00:00（以 timestamptz 儲存）
  ((now() AT TIME ZONE 'Asia/Hong_Kong')::date::timestamp) AT TIME ZONE 'Asia/Hong_Kong',
  -- next_due_at：下一個尚未到的香港 08:00
  (
    (
      (CASE
         WHEN (now() AT TIME ZONE 'Asia/Hong_Kong')::time < time '08:00'
           THEN (now() AT TIME ZONE 'Asia/Hong_Kong')::date
         ELSE (now() AT TIME ZONE 'Asia/Hong_Kong')::date + 1
       END) + time '08:00'
    ) AT TIME ZONE 'Asia/Hong_Kong'
  )
FROM 院友主表 p
WHERE p.在住狀態 = '在住'
  AND NOT EXISTS (
    SELECT 1
    FROM patient_health_tasks t
    WHERE t.patient_id = p.院友id
      AND t.health_record_type = '體溫'
      AND t.frequency_unit = 'daily'
      AND t.frequency_value = 1
      AND t.specific_times IS NOT DISTINCT FROM '["08:00"]'::jsonb
      AND t.notes IS NOT DISTINCT FROM '定期'::monitoring_task_notes
  );

COMMIT;
