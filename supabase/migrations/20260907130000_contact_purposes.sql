-- patient_contacts 聯絡用途標籤
--
-- 背景：原設計以單一 is_primary（第一聯絡人）標記聯絡人角色，
-- 實務上聯絡人可同時兼任多種用途（付款保證人/照顧保證人/緊急聯絡人等）。
-- 新增 purposes text[] 取代 is_primary 的語義；舊 is_primary=true 資料對應「付款保證人」。

ALTER TABLE patient_contacts ADD COLUMN IF NOT EXISTS purposes text[];

COMMENT ON COLUMN patient_contacts.purposes IS '聯絡用途標籤：付款保證人/照顧保證人/緊急聯絡人/社署監護人/社署受委人/其他（取代 is_primary 第一聯絡人）';

UPDATE patient_contacts SET purposes = ARRAY['付款保證人'] WHERE is_primary IS TRUE AND purposes IS NULL;
