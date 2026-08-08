-- 班次指派新增 override 標記，用於「仍要排班」時自動標記衝突的預排為待調整
ALTER TABLE user_shift_assignments
  ADD COLUMN IF NOT EXISTS is_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overridden_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overridden_at timestamptz;

COMMENT ON COLUMN user_shift_assignments.is_overridden IS '因與預排衝突而被 override，是否需重新調整';
COMMENT ON COLUMN user_shift_assignments.overridden_by IS '執行 override 的用戶';
COMMENT ON COLUMN user_shift_assignments.overridden_at IS 'override 時間';
