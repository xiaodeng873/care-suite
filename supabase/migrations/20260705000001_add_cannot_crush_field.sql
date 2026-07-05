-- Add cannot_crush field to medication_drug_database and new_medication_prescriptions

-- 1. 為藥物資料庫添加不可碎藥欄位
ALTER TABLE medication_drug_database
ADD COLUMN IF NOT EXISTS cannot_crush boolean DEFAULT false;

COMMENT ON COLUMN medication_drug_database.cannot_crush IS '藥物是否不可碎藥（true = 不可碎藥）';

-- 2. 為處方表添加不可碎藥欄位（繼承自藥物資料庫）
ALTER TABLE new_medication_prescriptions
ADD COLUMN IF NOT EXISTS cannot_crush boolean DEFAULT false;

COMMENT ON COLUMN new_medication_prescriptions.cannot_crush IS '該處方的藥物是否不可碎藥（true = 不可碎藥）';

-- 3. 建立索引以加快查詢
CREATE INDEX IF NOT EXISTS idx_medication_drug_database_cannot_crush 
ON medication_drug_database(cannot_crush) 
WHERE cannot_crush = true;

CREATE INDEX IF NOT EXISTS idx_new_medication_prescriptions_cannot_crush 
ON new_medication_prescriptions(cannot_crush) 
WHERE cannot_crush = true;
