-- 排班管理：班次設定同時受居住區與職位決定

-- =====================================================
-- 1) 為 station_shift_settings 增加職位欄位
-- =====================================================
ALTER TABLE station_shift_settings
  ADD COLUMN IF NOT EXISTS position text;

-- 移除舊的唯一約束（station_id, shift_name）
ALTER TABLE station_shift_settings
  DROP CONSTRAINT IF EXISTS station_shift_settings_station_id_shift_name_key;

-- 新的唯一約束：同一居住區、同一職位、同一班次只能有一筆設定
-- PostgreSQL 唯一索引允許多筆 NULL，因此 position = NULL 表示通用/遺留資料
CREATE UNIQUE INDEX IF NOT EXISTS idx_station_shift_settings_station_position_shift
  ON station_shift_settings (station_id, position, shift_name);

-- 原按居住區索引改為複合索引
DROP INDEX IF EXISTS idx_station_shift_settings_station_id;
CREATE INDEX IF NOT EXISTS idx_station_shift_settings_station_position
  ON station_shift_settings (station_id, position);

COMMENT ON COLUMN station_shift_settings.position IS '職位（如 主管、護理員、保健員）；NULL 表示通用/遺留設定';

-- =====================================================
-- 2) 將現有通用設定複製到各個常用職位，讓既有資料不會空白
-- =====================================================
DO $$
DECLARE
  pos text;
BEGIN
  FOR pos IN VALUES ('主管'), ('註冊/登記護士'), ('保健員'), ('護理員'), ('助理員'), ('物理治療師')
  LOOP
    INSERT INTO station_shift_settings (station_id, shift_name, start_time, is_active, sort_order, position)
    SELECT station_id, shift_name, start_time, is_active, sort_order, pos
    FROM station_shift_settings
    WHERE position IS NULL
    ON CONFLICT (station_id, position, shift_name) DO NOTHING;
  END LOOP;
END $$;
