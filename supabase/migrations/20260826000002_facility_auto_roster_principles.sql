-- 一鍵排班原則設定（按職位分頁儲存，JSONB）
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS auto_roster_principles jsonb NOT NULL DEFAULT '{}'::jsonb;
