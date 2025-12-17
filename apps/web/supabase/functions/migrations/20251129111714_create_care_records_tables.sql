/*
  # 建立護理記錄表格

  1. 新增表格
    - `patrol_rounds` - 巡房記錄
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key)
      - `patrol_date` (date) - 巡房日期
      - `patrol_time` (time) - 實際巡房時間
      - `scheduled_time` (text) - 預定時段 (如 "07:00")
      - `recorder` (text) - 記錄者
      - `notes` (text, nullable) - 備註
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `diaper_change_records` - 換片記錄
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key)
      - `change_date` (date) - 換片日期
      - `time_slot` (text) - 時段 (如 "7AM-10AM")
      - `has_urine` (boolean) - 有小便
      - `has_stool` (boolean) - 有大便
      - `has_none` (boolean) - 無
      - `urine_amount` (text, nullable) - 小便量: 多/中/少
      - `stool_color` (text, nullable) - 大便顏色: 正常/有血/有潺/黑便
      - `stool_texture` (text, nullable) - 大便質地: 硬/軟/稀
      - `stool_amount` (text, nullable) - 大便量: 多/中/少
      - `recorder` (text) - 記錄者
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `restraint_observation_records` - 約束物品觀察記錄
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key)
      - `observation_date` (date) - 觀察日期
      - `observation_time` (time) - 實際觀察時間
      - `scheduled_time` (text) - 預定時段
      - `observation_status` (text) - 觀察狀態: N(正常)/P(異常)/S(暫停)
      - `recorder` (text) - 記錄者
      - `notes` (text, nullable) - 備註
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `position_change_records` - 轉身記錄
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key)
      - `change_date` (date) - 轉身日期
      - `scheduled_time` (text) - 預定時段
      - `position` (text) - 轉身位置: 左/平/右
      - `recorder` (text) - 記錄者
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. 安全性
    - 所有表格啟用 RLS
    - 允許已認證用戶完整 CRUD 操作

  3. 索引
    - 為 patient_id, date, scheduled_time 等常用查詢欄位建立索引
*/

-- 1. 巡房記錄表
CREATE TABLE IF NOT EXISTS patrol_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  patrol_date date NOT NULL,
  patrol_time time NOT NULL,
  scheduled_time text NOT NULL,
  recorder text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patrol_rounds_patient_date 
  ON patrol_rounds (patient_id, patrol_date);
CREATE INDEX IF NOT EXISTS idx_patrol_rounds_scheduled_time 
  ON patrol_rounds (scheduled_time);

ALTER TABLE patrol_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to patrol_rounds"
  ON patrol_rounds
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. 換片記錄表
CREATE TABLE IF NOT EXISTS diaper_change_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  change_date date NOT NULL,
  time_slot text NOT NULL,
  has_urine boolean DEFAULT false,
  has_stool boolean DEFAULT false,
  has_none boolean DEFAULT false,
  urine_amount text,
  stool_color text,
  stool_texture text,
  stool_amount text,
  recorder text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diaper_change_records_patient_date 
  ON diaper_change_records (patient_id, change_date);
CREATE INDEX IF NOT EXISTS idx_diaper_change_records_time_slot 
  ON diaper_change_records (time_slot);

ALTER TABLE diaper_change_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to diaper_change_records"
  ON diaper_change_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. 約束物品觀察記錄表
CREATE TABLE IF NOT EXISTS restraint_observation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  observation_date date NOT NULL,
  observation_time time NOT NULL,
  scheduled_time text NOT NULL,
  observation_status text NOT NULL CHECK (observation_status IN ('N', 'P', 'S')),
  recorder text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restraint_observation_records_patient_date 
  ON restraint_observation_records (patient_id, observation_date);
CREATE INDEX IF NOT EXISTS idx_restraint_observation_records_scheduled_time 
  ON restraint_observation_records (scheduled_time);

ALTER TABLE restraint_observation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to restraint_observation_records"
  ON restraint_observation_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. 轉身記錄表
CREATE TABLE IF NOT EXISTS position_change_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  change_date date NOT NULL,
  scheduled_time text NOT NULL,
  position text NOT NULL CHECK (position IN ('左', '平', '右')),
  recorder text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_position_change_records_patient_date 
  ON position_change_records (patient_id, change_date);
CREATE INDEX IF NOT EXISTS idx_position_change_records_scheduled_time 
  ON position_change_records (scheduled_time);

ALTER TABLE position_change_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to position_change_records"
  ON position_change_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. 為所有表格添加 updated_at 自動更新觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_patrol_rounds_updated_at'
  ) THEN
    CREATE TRIGGER update_patrol_rounds_updated_at
      BEFORE UPDATE ON patrol_rounds
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_diaper_change_records_updated_at'
  ) THEN
    CREATE TRIGGER update_diaper_change_records_updated_at
      BEFORE UPDATE ON diaper_change_records
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_restraint_observation_records_updated_at'
  ) THEN
    CREATE TRIGGER update_restraint_observation_records_updated_at
      BEFORE UPDATE ON restraint_observation_records
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_position_change_records_updated_at'
  ) THEN
    CREATE TRIGGER update_position_change_records_updated_at
      BEFORE UPDATE ON position_change_records
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;