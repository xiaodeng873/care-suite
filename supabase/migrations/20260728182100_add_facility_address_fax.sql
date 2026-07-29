-- 為院舍設定加入地址、傳真，並將電話設為必填。
-- 現有單列資料的空白欄位會先填上預設空字串，避免 NOT NULL 約束失敗。

ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS facility_address_zh text;

ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS facility_address_en text;

ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS facility_fax text;

UPDATE facility_settings
SET
  facility_address_zh = COALESCE(facility_address_zh, ''),
  facility_address_en = COALESCE(facility_address_en, ''),
  facility_fax = COALESCE(facility_fax, ''),
  facility_phone = COALESCE(facility_phone, '')
WHERE id = 1;

ALTER TABLE facility_settings
ALTER COLUMN facility_address_zh SET NOT NULL;

ALTER TABLE facility_settings
ALTER COLUMN facility_fax SET NOT NULL;

ALTER TABLE facility_settings
ALTER COLUMN facility_phone SET NOT NULL;
