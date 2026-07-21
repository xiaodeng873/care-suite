-- 感染控制資料復原腳本
-- 用途：從 院友主表.感染控制（JSONB 陣列）重新把既有資料寫入 infection_control_records
-- 執行方式：在 Supabase SQL Editor 貼上並執行

-- ============================================================
-- 1. 先查看舊欄位還有多少筆資料
-- ============================================================
SELECT
  COUNT(*) AS 有感染控制資料的院友數
FROM "院友主表"
WHERE "感染控制" IS NOT NULL
  AND jsonb_array_length("感染控制") > 0;

-- ============================================================
-- 2. 把舊資料插回 infection_control_records（避免重複）
--    舊資料沒有確診/康復日期，確診日期統一用 1900-01-01（未知），康復日期留空
-- ============================================================
WITH source AS (
  SELECT
    "院友id" AS patient_id,
    jsonb_array_elements_text("感染控制") AS infection_type
  FROM "院友主表"
  WHERE "感染控制" IS NOT NULL
    AND jsonb_array_length("感染控制") > 0
)
INSERT INTO infection_control_records (patient_id, infection_type, diagnosis_date, recovery_date)
SELECT
  s.patient_id,
  s.infection_type,
  '1900-01-01'::date AS diagnosis_date,
  NULL AS recovery_date
FROM source s
WHERE NOT EXISTS (
  SELECT 1
  FROM infection_control_records icr
  WHERE icr.patient_id = s.patient_id
    AND icr.infection_type = s.infection_type
    AND icr.diagnosis_date = '1900-01-01'::date
);

-- ============================================================
-- 3. 復原後檢查
-- ============================================================
SELECT
  COUNT(*) AS infection_control_records總筆數,
  COUNT(DISTINCT patient_id) AS 涉及院友數
FROM infection_control_records;

-- 有資料的院友清單（取前 50）
SELECT
  p."院友id",
  p."中文姓名",
  p."床號",
  icr.infection_type,
  icr.diagnosis_date,
  icr.recovery_date
FROM infection_control_records icr
JOIN "院友主表" p ON p."院友id" = icr.patient_id
ORDER BY p."床號", icr.infection_type
LIMIT 50;
