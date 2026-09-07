-- 處方：服用時段2（與 meal_timing 以「或」連接，任一時段給服皆合處方要求）
-- 藥物資料庫：特殊用法、服用時段1/2（新增處方時預填）、糖尿病/降血壓藥物標籤

BEGIN;

-- new_medication_prescriptions：meal_timing 視為服用時段1，新增服用時段2
ALTER TABLE new_medication_prescriptions
    ADD COLUMN IF NOT EXISTS meal_timing_2 text;
COMMENT ON COLUMN new_medication_prescriptions.meal_timing IS '服用時段1（與服用時段2以「或」連接）';
COMMENT ON COLUMN new_medication_prescriptions.meal_timing_2 IS '服用時段2（與服用時段1以「或」連接，任一時段給服皆合處方要求）';

-- medication_drug_database：預設用法欄位
ALTER TABLE medication_drug_database
    ADD COLUMN IF NOT EXISTS special_dosage_instruction text,
    ADD COLUMN IF NOT EXISTS meal_timing_1 text,
    ADD COLUMN IF NOT EXISTS meal_timing_2 text;
COMMENT ON COLUMN medication_drug_database.special_dosage_instruction IS '預設特殊用法，新增處方時自動帶入';
COMMENT ON COLUMN medication_drug_database.meal_timing_1 IS '預設服用時段1，新增處方時自動帶入';
COMMENT ON COLUMN medication_drug_database.meal_timing_2 IS '預設服用時段2，新增處方時自動帶入';

-- medication_drug_database：藥物類別標籤（用於藥物調節監測提醒）
ALTER TABLE medication_drug_database
    ADD COLUMN IF NOT EXISTS is_diabetic_drug boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_antihypertensive_drug boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN medication_drug_database.is_diabetic_drug IS '糖尿病藥物：新增/調整劑量後提醒新增血糖值監測任務';
COMMENT ON COLUMN medication_drug_database.is_antihypertensive_drug IS '降血壓藥物：新增/調整劑量後提醒新增生命表徵監測任務';

COMMIT;
