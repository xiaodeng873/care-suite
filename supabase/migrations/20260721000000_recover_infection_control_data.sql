-- Migration: 復原既有感染控制資料到 infection_control_records
-- 日期: 2026-07-21
-- 用途：對 20260720000002_create_infection_control_records.sql 的補充，確保舊資料從 院友主表.感染控制 遷移過來
-- 注意：此腳本可重複執行，不會產生重複記錄

-- 從院友主表遷移既有感染控制資料
-- 舊資料沒有確診/康復日期，確診日期統一用 1900-01-01（未知），康復日期留空
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
)
ON CONFLICT DO NOTHING;
