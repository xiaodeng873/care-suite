/*
  # 處方新增專科與預計結束日期欄位

  1. 新增欄位（new_medication_prescriptions）
    - `medication_source_specialty` (text) — 藥物來源專科（醫管局專科，選填）
    - `estimated_end_date` (date) — 預計結束日期（推算值，專門處理沒有明確結束日期的長期藥物）

  2. 說明
    - medication_source 續用為「機構」（醫管局醫院/門診、衛生署診所、其他）
    - estimated_end_date 由 藥物數量 ÷ 每日平均用量 推算，起算日為 prescription_date
    - 僅在沒有 end_date 時才有意義；用於主畫面「藥物庫存不足」提醒
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'medication_source_specialty'
  ) THEN
    ALTER TABLE new_medication_prescriptions
    ADD COLUMN medication_source_specialty text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'estimated_end_date'
  ) THEN
    ALTER TABLE new_medication_prescriptions
    ADD COLUMN estimated_end_date date;
  END IF;
END $$;

COMMENT ON COLUMN new_medication_prescriptions.medication_source_specialty IS '藥物來源專科（醫管局專科，選填）';
COMMENT ON COLUMN new_medication_prescriptions.estimated_end_date IS '預計結束日期（推算：藥物數量÷每日平均用量，起算 prescription_date），用於藥物庫存不足提醒';
