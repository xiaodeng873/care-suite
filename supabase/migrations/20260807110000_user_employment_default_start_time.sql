-- 僱傭詳情：增加預設上班時間，拖入排班表時優先使用

ALTER TABLE user_employment_details
  ADD COLUMN IF NOT EXISTS default_work_start_time text;

COMMENT ON COLUMN user_employment_details.default_work_start_time IS '員工預設上班時間（HH:MM），拖入排班表時優先使用，未設定則跟從班次開始時間';
