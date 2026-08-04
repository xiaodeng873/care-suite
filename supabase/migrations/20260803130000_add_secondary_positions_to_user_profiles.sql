-- 次要職位（排班管理底層邏輯）
-- user_profiles 增加 secondary_positions 欄位：
-- 用戶除主要職位外，可設定多個次要職位，必要時在排班表內擔任該角色。

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS secondary_positions text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN user_profiles.secondary_positions IS '次要職位列表（可擔任其他角色），元素為職位名稱，如 主管/註冊護士/登記護士/保健員/護理員/助理員/物理治療師 等';
