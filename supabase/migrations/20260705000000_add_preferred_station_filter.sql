-- Add preferred station filter to user_profiles
-- Stores user's last selected station filter preference

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS preferred_station_ids jsonb DEFAULT NULL;

-- Add index for future queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_preferred_station_ids ON user_profiles USING gin(preferred_station_ids);

COMMENT ON COLUMN user_profiles.preferred_station_ids IS '用戶上次登出前選擇的居住區 ID 陣列（JSON 格式），例如: ["1", "2", "3"]';
