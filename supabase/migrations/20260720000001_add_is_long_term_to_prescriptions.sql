/*
  # 新增處方長期藥物標記 is_long_term

  1. 在 new_medication_prescriptions 新增 is_long_term boolean 欄位
  2. 首次登記時：有 end_date 為短期（false），無 end_date 為長期（true）
  3. 往後停服不改變 is_long_term，只改 status 與 discontinuation_date（如適用）
  4. 現有記錄遷移：
     - end_date IS NULL → true（長期）
     - end_date IS NOT NULL 但 estimated_end_date IS NOT NULL → true（長期，後來停服）
     - end_date IS NOT NULL 且 estimated_end_date IS NULL → false（短期）
*/

-- 新增欄位
ALTER TABLE new_medication_prescriptions
ADD COLUMN IF NOT EXISTS is_long_term boolean;

-- 為現有記錄推斷長期/短期
UPDATE new_medication_prescriptions
SET is_long_term = CASE
  WHEN end_date IS NULL THEN true
  WHEN estimated_end_date IS NOT NULL THEN true
  ELSE false
END
WHERE is_long_term IS NULL;

-- 設定預設值，避免未來遺漏
ALTER TABLE new_medication_prescriptions
ALTER COLUMN is_long_term SET DEFAULT false;

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_new_medication_prescriptions_is_long_term
ON new_medication_prescriptions(is_long_term);

COMMENT ON COLUMN new_medication_prescriptions.is_long_term IS '首次登記時是否為長期藥物（true=長期，false=短期）。停服後不應改變此值。';
