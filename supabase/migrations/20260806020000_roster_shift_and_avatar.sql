-- 排班管理：員工相片、職位班次設定、班次指派、未上班記錄

-- =====================================================
-- 1) Storage bucket：員工大頭照
-- =====================================================
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types, created_at)
VALUES ('avatars', 'avatars', true, false, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'], now())
ON CONFLICT (id) DO NOTHING;

-- 允許已認證用戶讀取/上傳/更新 avatars bucket
DROP POLICY IF EXISTS "允許認證用戶讀取 avatars" ON storage.objects;
CREATE POLICY "允許認證用戶讀取 avatars" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "允許認證用戶上傳 avatars" ON storage.objects;
CREATE POLICY "允許認證用戶上傳 avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "允許認證用戶更新 avatars" ON storage.objects;
CREATE POLICY "允許認證用戶更新 avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

-- =====================================================
-- 2) user_profiles：新增 avatar_url
-- =====================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- =====================================================
-- 3) position_shift_settings：職位班次設定
-- =====================================================
CREATE TABLE IF NOT EXISTS position_shift_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position text NOT NULL,
  shift_name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position, shift_name)
);

CREATE INDEX IF NOT EXISTS idx_position_shift_settings_position ON position_shift_settings(position);

COMMENT ON TABLE position_shift_settings IS '各職位的班次時間設定，例如護理員早/午/晚班';
COMMENT ON COLUMN position_shift_settings.position IS '職位名稱，對應 EmploymentPosition';
COMMENT ON COLUMN position_shift_settings.shift_name IS '班次名稱，如 早班/午班/晚班';
COMMENT ON COLUMN position_shift_settings.start_time IS '班次開始時間';
COMMENT ON COLUMN position_shift_settings.end_time IS '班次結束時間';
COMMENT ON COLUMN position_shift_settings.is_active IS '是否啟用';
COMMENT ON COLUMN position_shift_settings.sort_order IS '排序';

ALTER TABLE position_shift_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許所有操作_職位班次設定" ON position_shift_settings;
CREATE POLICY "允許所有操作_職位班次設定" ON position_shift_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_position_shift_settings_updated_at ON position_shift_settings;
CREATE TRIGGER update_position_shift_settings_updated_at
  BEFORE UPDATE ON position_shift_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 預設班次時間
INSERT INTO position_shift_settings (position, shift_name, start_time, end_time, is_active, sort_order) VALUES
  ('主管', '早班', '07:00', '15:00', true, 1),
  ('主管', '午班', '13:00', '21:00', true, 2),
  ('註冊護士', '早班', '07:00', '15:00', true, 1),
  ('註冊護士', '午班', '15:00', '23:00', true, 2),
  ('註冊護士', '晚班', '23:00', '07:00', true, 3),
  ('登記護士', '早班', '07:00', '15:00', true, 1),
  ('登記護士', '午班', '15:00', '23:00', true, 2),
  ('登記護士', '晚班', '23:00', '07:00', true, 3),
  ('保健員', '早班', '07:00', '15:00', true, 1),
  ('保健員', '午班', '15:00', '23:00', true, 2),
  ('護理員', '早班', '07:00', '15:00', true, 1),
  ('護理員', '午班', '15:00', '23:00', true, 2),
  ('護理員', '晚班', '23:00', '07:00', true, 3),
  ('助理員', '早班', '07:00', '15:00', true, 1),
  ('助理員', '午班', '15:00', '23:00', true, 2),
  ('助理員', '晚班', '23:00', '07:00', true, 3),
  ('物理治療師', '早班', '09:00', '17:00', true, 1)
ON CONFLICT (position, shift_name) DO NOTHING;

-- =====================================================
-- 4) user_shift_assignments：班次指派
-- =====================================================
CREATE TABLE IF NOT EXISTS user_shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  shift_name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_shift_per_user_per_day UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_user_shift_assignments_user_date ON user_shift_assignments(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_user_shift_assignments_station ON user_shift_assignments(station_id);
CREATE INDEX IF NOT EXISTS idx_user_shift_assignments_work_date ON user_shift_assignments(work_date);

COMMENT ON TABLE user_shift_assignments IS '員工每日班次指派，同一天只能排一班';
COMMENT ON COLUMN user_shift_assignments.station_id IS 'NULL 表示未分區';

ALTER TABLE user_shift_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許所有操作_班次指派" ON user_shift_assignments;
CREATE POLICY "允許所有操作_班次指派" ON user_shift_assignments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_user_shift_assignments_updated_at ON user_shift_assignments;
CREATE TRIGGER update_user_shift_assignments_updated_at
  BEFORE UPDATE ON user_shift_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5) user_absence_records：未上班原因
-- =====================================================
CREATE TABLE IF NOT EXISTS user_absence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  absence_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, absence_date)
);

CREATE INDEX IF NOT EXISTS idx_user_absence_records_user_date ON user_absence_records(user_id, absence_date);
CREATE INDEX IF NOT EXISTS idx_user_absence_records_absence_date ON user_absence_records(absence_date);

COMMENT ON TABLE user_absence_records IS '員工某日未上班原因';

ALTER TABLE user_absence_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許所有操作_未上班記錄" ON user_absence_records;
CREATE POLICY "允許所有操作_未上班記錄" ON user_absence_records
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_user_absence_records_updated_at ON user_absence_records;
CREATE TRIGGER update_user_absence_records_updated_at
  BEFORE UPDATE ON user_absence_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
