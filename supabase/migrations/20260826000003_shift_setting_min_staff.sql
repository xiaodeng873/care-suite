-- 班次設定：每班最少人數（取代一鍵排班原則1）
ALTER TABLE station_shift_settings
  ADD COLUMN IF NOT EXISTS min_staff integer NOT NULL DEFAULT 0;
