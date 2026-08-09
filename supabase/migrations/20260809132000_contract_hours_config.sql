-- 買位合約工時用戶設定（甲一/甲二各職位每週總工時絕對值；NULL = 全部按每 40 宿位基準換算）
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS contract_hours_config jsonb;

COMMENT ON COLUMN facility_settings.contract_hours_config IS '買位合約工時設定：{ "甲一買位": { "護士": 367.2, ... }, "甲二買位": { ... } }，每週總工時絕對值，缺省職位按基準換算';
