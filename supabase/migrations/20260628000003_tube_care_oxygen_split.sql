/*
  # 氧氣喉管「清洗+更換一套」重設計 + 新增「造口袋更換」

  1. 為 patient_tube_care_records 新增兩個間隔欄位
     - wash_cycle_days (integer)    氧氣喉管：清洗間隔（預設 1 天）
     - replace_cycle_days (integer) 氧氣喉管：更換間隔（預設 7 天）
     氧氣喉管改為一條同時帶清洗與更換兩個獨立排程；
     清洗/更換各自獨立計算到期日，不再共用單一 cycle_days。
     （cycle_days 仍保留供「造口袋更換」與舊資料使用）

  2. 更新 care_type 檢查約束，加入「造口袋更換」
*/

-- 新增氧氣喉管清洗/更換間隔欄位
ALTER TABLE patient_tube_care_records
  ADD COLUMN IF NOT EXISTS wash_cycle_days integer,
  ADD COLUMN IF NOT EXISTS replace_cycle_days integer;

-- 先移除舊約束，才能更新資料
ALTER TABLE patient_tube_care_records
  DROP CONSTRAINT IF EXISTS patient_tube_care_records_care_type_check;

-- 將舊資料中的「尿導管更換」統一為「導尿管更換」
UPDATE patient_tube_care_records
SET care_type = '導尿管更換'
WHERE care_type = '尿導管更換';

-- 更新 care_type 檢查約束以加入「造口袋更換」
ALTER TABLE patient_tube_care_records
  ADD CONSTRAINT patient_tube_care_records_care_type_check
  CHECK (care_type IN ('導尿管更換', '鼻胃飼管更換', '氧氣喉管清洗/更換', '造口袋更換'));
