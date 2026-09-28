-- 覆診安排通知訊息模板（陪診員／輪椅的士／問家人），per-user
-- 儲存於 user_profiles jsonb；已認證用戶可讀/更新（RLS 已於 20260101000000_create_user_management_system.sql 建立）

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS followup_message_templates jsonb;
COMMENT ON COLUMN user_profiles.followup_message_templates IS '覆診通知訊息模板：{companion: {template, phone}, taxi: {template, phone}, family: {template, phone}}，佔位符 {院友名稱}{院舍名稱}{覆診日期}{覆診時間}{出發時間}{覆診地點}{覆診專科}';
