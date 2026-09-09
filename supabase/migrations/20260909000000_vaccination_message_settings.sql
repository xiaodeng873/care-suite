-- 疫苗記錄 WhatsApp 意向查詢訊息設定（per-user）
-- 儲存於 user_profiles，已認證用戶可讀/更新（RLS 已於 20260101000000_create_user_management_system.sql 建立，無需新增 policy）

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_message_template text;
COMMENT ON COLUMN user_profiles.vaccination_message_template IS '疫苗意向查詢 WhatsApp 訊息模板';

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_vaccine_name text;
COMMENT ON COLUMN user_profiles.vaccination_vaccine_name IS '疫苗意向查詢訊息：疫苗名稱';

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_vaccine_name_2 text;
COMMENT ON COLUMN user_profiles.vaccination_vaccine_name_2 IS '疫苗意向查詢訊息：疫苗名稱2（第二種疫苗，可留空）';

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_vaccination_date text;
COMMENT ON COLUMN user_profiles.vaccination_vaccination_date IS '疫苗意向查詢訊息：接種日期';

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_deadline text;
COMMENT ON COLUMN user_profiles.vaccination_deadline IS '疫苗意向查詢訊息：簽署截止日期';
