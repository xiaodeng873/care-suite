-- 排班管理：班次由居住區決定，只記起始時間；移除職位班次設定，改為居住區班次設定

-- =====================================================
-- 1) 建立 station_shift_settings（居住區班次設定）
-- =====================================================
CREATE TABLE IF NOT EXISTS station_shift_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  shift_name text NOT NULL CHECK (shift_name IN ('早班', '午班', '晚班')),
  start_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, shift_name)
);

CREATE INDEX IF NOT EXISTS idx_station_shift_settings_station_id ON station_shift_settings(station_id);

COMMENT ON TABLE station_shift_settings IS '各居住區的班次時間設定';
COMMENT ON COLUMN station_shift_settings.station_id IS 'NULL 表示全院/未分區通用班次';
COMMENT ON COLUMN station_shift_settings.shift_name IS '早班/午班/晚班';
COMMENT ON COLUMN station_shift_settings.start_time IS '班次開始時間；結束時間由員工 daily_contract_hours 決定';
COMMENT ON COLUMN station_shift_settings.is_active IS '是否啟用';

ALTER TABLE station_shift_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許所有操作_居住區班次設定" ON station_shift_settings;
CREATE POLICY "允許所有操作_居住區班次設定" ON station_shift_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_station_shift_settings_updated_at ON station_shift_settings;
CREATE TRIGGER update_station_shift_settings_updated_at
  BEFORE UPDATE ON station_shift_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 預設：每個居住區都有早 07:00 / 午 13:00 / 晚 22:00（未分區用 NULL station_id）
INSERT INTO station_shift_settings (station_id, shift_name, start_time, is_active, sort_order)
SELECT s.id, t.shift_name, t.start_time::time, true, t.sort_order
FROM stations s
CROSS JOIN (VALUES
  ('早班', '07:00', 1),
  ('午班', '13:00', 2),
  ('晚班', '22:00', 3)
) AS t(shift_name, start_time, sort_order)
ON CONFLICT (station_id, shift_name) DO NOTHING;

-- 未分區預設班次
INSERT INTO station_shift_settings (station_id, shift_name, start_time, is_active, sort_order) VALUES
  (NULL, '早班', '07:00'::time, true, 1),
  (NULL, '午班', '13:00'::time, true, 2),
  (NULL, '晚班', '22:00'::time, true, 3)
ON CONFLICT (station_id, shift_name) DO NOTHING;

-- =====================================================
-- 2) 調整 user_shift_assignments：只記起始時間
-- =====================================================
ALTER TABLE user_shift_assignments
  DROP COLUMN IF EXISTS end_time;

-- =====================================================
-- 3) 移除舊的職位班次設定表
-- =====================================================
DROP TABLE IF EXISTS position_shift_settings CASCADE;
