-- Add preferred theme (light/dark) to user_profiles
-- Stores user's last selected UI theme so it follows them across browsers/devices

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS preferred_theme text DEFAULT NULL;

COMMENT ON COLUMN user_profiles.preferred_theme IS '用戶上次選擇的系統主題（light / dark），跨瀏覽器/裝置沿用';
