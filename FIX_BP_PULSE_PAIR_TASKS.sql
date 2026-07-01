-- ================================================================
-- 補充血壓/脈搏缺對任務
-- 規則：若院友名下存在血壓任務但缺少「相同頻率+相同特定時間」的脈搏任務，
--       則自動複製一筆脈搏任務（反之亦然）。
-- 執行方式：在 Supabase SQL Editor 或 psql 執行此腳本即可。
-- ================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. 針對每筆「血壓」任務，若找不到頻率及時間相同的「脈搏」任務，
--    則依血壓任務複製一筆脈搏任務。
-- ────────────────────────────────────────────────────────────────
INSERT INTO patient_health_tasks (
  patient_id,
  health_record_type,
  frequency_unit,
  frequency_value,
  specific_times,
  specific_days_of_week,
  specific_days_of_month,
  next_due_at,
  notes,
  is_recurring,
  start_date,
  end_date,
  created_at,
  updated_at
)
SELECT
  bp.patient_id,
  '脈搏',
  bp.frequency_unit,
  bp.frequency_value,
  bp.specific_times,
  bp.specific_days_of_week,
  bp.specific_days_of_month,
  bp.next_due_at,
  bp.notes,
  bp.is_recurring,
  bp.start_date,
  bp.end_date,
  now(),
  now()
FROM patient_health_tasks bp
WHERE bp.health_record_type = '血壓'
  AND NOT EXISTS (
    SELECT 1
    FROM patient_health_tasks p2
    WHERE p2.patient_id       = bp.patient_id
      AND p2.health_record_type = '脈搏'
      AND p2.frequency_unit   = bp.frequency_unit
      AND p2.frequency_value  = bp.frequency_value
      AND (p2.specific_times IS NOT DISTINCT FROM bp.specific_times)
  );

-- ────────────────────────────────────────────────────────────────
-- 2. 針對每筆「脈搏」任務，若找不到頻率及時間相同的「血壓」任務，
--    則依脈搏任務複製一筆血壓任務。
--    （步驟 1 新增的脈搏任務已有對應血壓任務，NOT EXISTS 不會重複觸發。）
-- ────────────────────────────────────────────────────────────────
INSERT INTO patient_health_tasks (
  patient_id,
  health_record_type,
  frequency_unit,
  frequency_value,
  specific_times,
  specific_days_of_week,
  specific_days_of_month,
  next_due_at,
  notes,
  is_recurring,
  start_date,
  end_date,
  created_at,
  updated_at
)
SELECT
  p.patient_id,
  '血壓',
  p.frequency_unit,
  p.frequency_value,
  p.specific_times,
  p.specific_days_of_week,
  p.specific_days_of_month,
  p.next_due_at,
  p.notes,
  p.is_recurring,
  p.start_date,
  p.end_date,
  now(),
  now()
FROM patient_health_tasks p
WHERE p.health_record_type = '脈搏'
  AND NOT EXISTS (
    SELECT 1
    FROM patient_health_tasks p2
    WHERE p2.patient_id       = p.patient_id
      AND p2.health_record_type = '血壓'
      AND p2.frequency_unit   = p.frequency_unit
      AND p2.frequency_value  = p.frequency_value
      AND (p2.specific_times IS NOT DISTINCT FROM p.specific_times)
  );

COMMIT;

-- ================================================================
-- 執行後可用以下查詢確認還有無缺對：
-- ================================================================
-- SELECT bp.patient_id, bp.frequency_unit, bp.frequency_value, bp.specific_times,
--        '有血壓缺脈搏' AS 狀況
-- FROM patient_health_tasks bp
-- WHERE bp.health_record_type = '血壓'
--   AND NOT EXISTS (
--     SELECT 1 FROM patient_health_tasks p2
--     WHERE p2.patient_id = bp.patient_id AND p2.health_record_type = '脈搏'
--       AND p2.frequency_unit = bp.frequency_unit AND p2.frequency_value = bp.frequency_value
--       AND (p2.specific_times IS NOT DISTINCT FROM bp.specific_times)
--   )
-- UNION ALL
-- SELECT p.patient_id, p.frequency_unit, p.frequency_value, p.specific_times,
--        '有脈搏缺血壓' AS 狀況
-- FROM patient_health_tasks p
-- WHERE p.health_record_type = '脈搏'
--   AND NOT EXISTS (
--     SELECT 1 FROM patient_health_tasks p2
--     WHERE p2.patient_id = p.patient_id AND p2.health_record_type = '血壓'
--       AND p2.frequency_unit = p.frequency_unit AND p2.frequency_value = p.frequency_value
--       AND (p2.specific_times IS NOT DISTINCT FROM p.specific_times)
--   );
