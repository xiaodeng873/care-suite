-- 所有藥物名稱統一轉成大寫（配合前端寫入時強制 toUpperCase）
-- 1) 藥物資料庫
UPDATE medication_drug_database
SET drug_name = upper(drug_name)
WHERE drug_name IS NOT NULL AND drug_name <> upper(drug_name);

-- 2) 處方（藥名要跟藥物資料庫對照，必須同步）
UPDATE new_medication_prescriptions
SET medication_name = upper(medication_name)
WHERE medication_name IS NOT NULL AND medication_name <> upper(medication_name);
