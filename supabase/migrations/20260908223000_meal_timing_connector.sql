-- 服用時段連接詞：處方及藥物資料庫皆新增 meal_timing_connector（「或」/「及」）

BEGIN;

-- new_medication_prescriptions：時段1/時段2 的連接詞
ALTER TABLE new_medication_prescriptions
    ADD COLUMN IF NOT EXISTS meal_timing_connector text DEFAULT '或';
COMMENT ON COLUMN new_medication_prescriptions.meal_timing_connector IS '服用時段連接詞：「或」=任一時段給服皆合處方要求；「及」=兩時段皆需給服';

-- medication_drug_database：預設連接詞（新增處方時自動帶入）
ALTER TABLE medication_drug_database
    ADD COLUMN IF NOT EXISTS meal_timing_connector text DEFAULT '或';
COMMENT ON COLUMN medication_drug_database.meal_timing_connector IS '預設服用時段連接詞（或/及），新增處方時自動帶入';

COMMIT;
