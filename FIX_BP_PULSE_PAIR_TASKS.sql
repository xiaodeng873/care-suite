-- ================================================================
-- 血壓/脈搏任務：清理重複 + 補齊配對（v3 最終版）
-- ================================================================
-- 本腳本一次完成兩件事，且「冪等安全」——重複執行、或舊版 SQL 從未
-- 執行過，皆不會誤刪或多建：
--
--   步驟 1【清理】刪除完全重複的血壓/脈搏任務。
--       重複定義 = 同 patient_id + 同 health_record_type + 完整簽章相同：
--         frequency_unit / frequency_value / specific_times /
--         specific_days_of_week / specific_days_of_month / notes
--       每組只保留「最早建立（created_at 最小，id 次之）」的一筆，
--       其餘刪除。→ 修正舊版無 DISTINCT 造成的重複列。
--
--   步驟 2【補對】對每個排程簽章，若只有血壓或只有脈搏，補上另一半。
--       配對鍵（完整簽章 + notes，start_date 不算入）：
--         patient_id + frequency_unit + frequency_value + specific_times
--         + specific_days_of_week + specific_days_of_month + notes
--       新任務：
--         - next_due_at        照抄來源（與來源同時到期、成對出現）
--         - start_date         一律設為 2026-07-02（補建標記）
--         - last_completed_at  留 NULL
--         - is_recurring/end_date/end_time 照抄來源（含非循環任務）
--       同簽章只補一筆（DISTINCT ON）。
--
-- 執行順序：先清理、後補對（步驟 2 讀取的是已清理的資料）。
-- 執行後直接輸出「異動清單」（刪除 / 新增）供人工核對。
-- 執行方式：於 Supabase SQL Editor 或 psql 整份執行。
-- ================================================================

BEGIN;

-- 異動報告暫存表
CREATE TEMP TABLE _pair_report (
  動作                    text,
  patient_id             integer,
  health_record_type     text,
  frequency_unit         text,
  frequency_value        integer,
  specific_times         jsonb,
  specific_days_of_week  jsonb,
  specific_days_of_month jsonb,
  notes                  text,
  next_due_at            timestamptz
) ON COMMIT DROP;

-- ── 步驟 1：刪除完全重複的血壓/脈搏任務（每組保留最早一筆）──
WITH d AS (
  DELETE FROM patient_health_tasks t
  USING (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY
               patient_id,
               health_record_type,
               frequency_unit,
               frequency_value,
               specific_times::text,
               specific_days_of_week::text,
               specific_days_of_month::text,
               notes
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM patient_health_tasks
    WHERE health_record_type IN ('血壓', '脈搏')
  ) r
  WHERE t.id = r.id
    AND r.rn > 1
  RETURNING t.patient_id, t.health_record_type, t.frequency_unit, t.frequency_value,
            t.specific_times, t.specific_days_of_week, t.specific_days_of_month,
            t.notes, t.next_due_at
)
INSERT INTO _pair_report
SELECT '刪除重複', patient_id, health_record_type, frequency_unit, frequency_value,
       specific_times, specific_days_of_week, specific_days_of_month, notes, next_due_at
FROM d;

-- ── 步驟 2a：補「缺少的脈搏」任務 ──
WITH bp_missing_pulse AS (
  SELECT DISTINCT ON (
      bp.patient_id, bp.frequency_unit, bp.frequency_value,
      bp.specific_times, bp.specific_days_of_week, bp.specific_days_of_month, bp.notes
    )
    bp.patient_id, bp.frequency_unit, bp.frequency_value,
    bp.specific_times, bp.specific_days_of_week, bp.specific_days_of_month, bp.notes,
    bp.next_due_at, bp.is_recurring, bp.end_date, bp.end_time
  FROM patient_health_tasks bp
  WHERE bp.health_record_type = '血壓'
    AND NOT EXISTS (
      SELECT 1 FROM patient_health_tasks p2
      WHERE p2.health_record_type = '脈搏'
        AND p2.patient_id            = bp.patient_id
        AND p2.frequency_unit        = bp.frequency_unit
        AND p2.frequency_value       = bp.frequency_value
        AND p2.specific_times          IS NOT DISTINCT FROM bp.specific_times
        AND p2.specific_days_of_week   IS NOT DISTINCT FROM bp.specific_days_of_week
        AND p2.specific_days_of_month  IS NOT DISTINCT FROM bp.specific_days_of_month
        AND p2.notes                   IS NOT DISTINCT FROM bp.notes
    )
  ORDER BY
    bp.patient_id, bp.frequency_unit, bp.frequency_value,
    bp.specific_times, bp.specific_days_of_week, bp.specific_days_of_month, bp.notes,
    bp.next_due_at ASC NULLS LAST
),
ins_pulse AS (
  INSERT INTO patient_health_tasks (
    patient_id, health_record_type, frequency_unit, frequency_value,
    specific_times, specific_days_of_week, specific_days_of_month,
    next_due_at, notes, is_recurring, start_date, end_date, end_time,
    created_at, updated_at
  )
  SELECT
    patient_id, '脈搏', frequency_unit, frequency_value,
    specific_times, specific_days_of_week, specific_days_of_month,
    next_due_at, notes, is_recurring, '2026-07-02'::timestamptz, end_date, end_time,
    now(), now()
  FROM bp_missing_pulse
  RETURNING patient_id, health_record_type, frequency_unit, frequency_value,
            specific_times, specific_days_of_week, specific_days_of_month, notes, next_due_at
)
INSERT INTO _pair_report
SELECT '新增脈搏', patient_id, health_record_type, frequency_unit, frequency_value,
       specific_times, specific_days_of_week, specific_days_of_month, notes, next_due_at
FROM ins_pulse;

-- ── 步驟 2b：補「缺少的血壓」任務 ──
WITH pulse_missing_bp AS (
  SELECT DISTINCT ON (
      p.patient_id, p.frequency_unit, p.frequency_value,
      p.specific_times, p.specific_days_of_week, p.specific_days_of_month, p.notes
    )
    p.patient_id, p.frequency_unit, p.frequency_value,
    p.specific_times, p.specific_days_of_week, p.specific_days_of_month, p.notes,
    p.next_due_at, p.is_recurring, p.end_date, p.end_time
  FROM patient_health_tasks p
  WHERE p.health_record_type = '脈搏'
    AND NOT EXISTS (
      SELECT 1 FROM patient_health_tasks p2
      WHERE p2.health_record_type = '血壓'
        AND p2.patient_id            = p.patient_id
        AND p2.frequency_unit        = p.frequency_unit
        AND p2.frequency_value       = p.frequency_value
        AND p2.specific_times          IS NOT DISTINCT FROM p.specific_times
        AND p2.specific_days_of_week   IS NOT DISTINCT FROM p.specific_days_of_week
        AND p2.specific_days_of_month  IS NOT DISTINCT FROM p.specific_days_of_month
        AND p2.notes                   IS NOT DISTINCT FROM p.notes
    )
  ORDER BY
    p.patient_id, p.frequency_unit, p.frequency_value,
    p.specific_times, p.specific_days_of_week, p.specific_days_of_month, p.notes,
    p.next_due_at ASC NULLS LAST
),
ins_bp AS (
  INSERT INTO patient_health_tasks (
    patient_id, health_record_type, frequency_unit, frequency_value,
    specific_times, specific_days_of_week, specific_days_of_month,
    next_due_at, notes, is_recurring, start_date, end_date, end_time,
    created_at, updated_at
  )
  SELECT
    patient_id, '血壓', frequency_unit, frequency_value,
    specific_times, specific_days_of_week, specific_days_of_month,
    next_due_at, notes, is_recurring, '2026-07-02'::timestamptz, end_date, end_time,
    now(), now()
  FROM pulse_missing_bp
  RETURNING patient_id, health_record_type, frequency_unit, frequency_value,
            specific_times, specific_days_of_week, specific_days_of_month, notes, next_due_at
)
INSERT INTO _pair_report
SELECT '新增血壓', patient_id, health_record_type, frequency_unit, frequency_value,
       specific_times, specific_days_of_week, specific_days_of_month, notes, next_due_at
FROM ins_bp;

-- ── 異動清單（供人工核對）──
SELECT
  pt.床號,
  pt.中文姓名,
  r.動作,
  r.health_record_type          AS 任務類型,
  r.frequency_unit              AS 頻率單位,
  r.frequency_value             AS 頻率值,
  r.specific_times              AS 特定時間,
  r.specific_days_of_week       AS 每週日,
  r.specific_days_of_month      AS 每月日,
  r.notes                       AS 備註,
  r.next_due_at                 AS 下次到期
FROM _pair_report r
JOIN "院友主表" pt ON pt."院友id" = r.patient_id
ORDER BY pt.床號, pt.中文姓名, r.動作, r.health_record_type, r.frequency_unit, r.frequency_value;

COMMIT;

-- ================================================================
-- 【驗證查詢】執行上方腳本後，可單獨執行以下查詢：
--   (A) 若回傳 0 列 → 所有血壓/脈搏任務皆已成對，無遺漏。
-- ================================================================
-- SELECT '有血壓缺脈搏' AS 狀況, bp.patient_id, bp.frequency_unit, bp.frequency_value,
--        bp.specific_times, bp.specific_days_of_week, bp.specific_days_of_month, bp.notes
-- FROM patient_health_tasks bp
-- WHERE bp.health_record_type = '血壓'
--   AND NOT EXISTS (
--     SELECT 1 FROM patient_health_tasks p2
--     WHERE p2.health_record_type = '脈搏'
--       AND p2.patient_id           = bp.patient_id
--       AND p2.frequency_unit       = bp.frequency_unit
--       AND p2.frequency_value      = bp.frequency_value
--       AND p2.specific_times         IS NOT DISTINCT FROM bp.specific_times
--       AND p2.specific_days_of_week  IS NOT DISTINCT FROM bp.specific_days_of_week
--       AND p2.specific_days_of_month IS NOT DISTINCT FROM bp.specific_days_of_month
--       AND p2.notes                  IS NOT DISTINCT FROM bp.notes
--   )
-- UNION ALL
-- SELECT '有脈搏缺血壓' AS 狀況, p.patient_id, p.frequency_unit, p.frequency_value,
--        p.specific_times, p.specific_days_of_week, p.specific_days_of_month, p.notes
-- FROM patient_health_tasks p
-- WHERE p.health_record_type = '脈搏'
--   AND NOT EXISTS (
--     SELECT 1 FROM patient_health_tasks p2
--     WHERE p2.health_record_type = '血壓'
--       AND p2.patient_id           = p.patient_id
--       AND p2.frequency_unit       = p.frequency_unit
--       AND p2.frequency_value      = p.frequency_value
--       AND p2.specific_times         IS NOT DISTINCT FROM p.specific_times
--       AND p2.specific_days_of_week  IS NOT DISTINCT FROM p.specific_days_of_week
--       AND p2.specific_days_of_month IS NOT DISTINCT FROM p.specific_days_of_month
--       AND p2.notes                  IS NOT DISTINCT FROM p.notes
--   );

-- ================================================================
--   (B) 若回傳任何列 → 仍有完全重複的血壓/脈搏任務（理論上不應發生）。
-- ================================================================
-- SELECT patient_id, health_record_type, frequency_unit, frequency_value,
--        specific_times, specific_days_of_week, specific_days_of_month, notes,
--        COUNT(*) AS 重複數
-- FROM patient_health_tasks
-- WHERE health_record_type IN ('血壓', '脈搏')
-- GROUP BY patient_id, health_record_type, frequency_unit, frequency_value,
--          specific_times::text, specific_days_of_week::text,
--          specific_days_of_month::text, notes,
--          specific_times, specific_days_of_week, specific_days_of_month
-- HAVING COUNT(*) > 1;
