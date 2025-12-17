/*
  # 新增院友護理記錄選項卡配置表和約束物品欄位

  1. 新增表格
    - `patient_care_tabs` - 院友護理記錄選項卡配置
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key) - 院友 ID
      - `tab_type` (text) - 選項卡類型: patrol/diaper/intake_output/restraint/position/toilet_training
      - `is_manually_added` (boolean) - 是否手動添加
      - `is_hidden` (boolean) - 是否被隱藏
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. 修改表格
    - `restraint_observation_records` 
      - 新增 `used_restraints` (jsonb, nullable) - 使用的約束物品
      
  3. 安全性
    - 啟用 RLS
    - 允許已認證用戶完整 CRUD 操作

  4. 索引
    - 為 patient_id 和 tab_type 建立索引
*/

-- 1. 創建院友護理記錄選項卡配置表
CREATE TABLE IF NOT EXISTS patient_care_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  tab_type text NOT NULL CHECK (tab_type IN ('patrol', 'diaper', 'intake_output', 'restraint', 'position', 'toilet_training')),
  is_manually_added boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(patient_id, tab_type)
);

CREATE INDEX IF NOT EXISTS idx_patient_care_tabs_patient_id 
  ON patient_care_tabs (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_care_tabs_tab_type 
  ON patient_care_tabs (tab_type);
CREATE INDEX IF NOT EXISTS idx_patient_care_tabs_patient_visible
  ON patient_care_tabs (patient_id, is_hidden);

ALTER TABLE patient_care_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to patient_care_tabs"
  ON patient_care_tabs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. 為 patient_care_tabs 添加 updated_at 自動更新觸發器
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_patient_care_tabs_updated_at'
  ) THEN
    CREATE TRIGGER update_patient_care_tabs_updated_at
      BEFORE UPDATE ON patient_care_tabs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 3. 為約束觀察記錄表添加 used_restraints 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restraint_observation_records' 
    AND column_name = 'used_restraints'
  ) THEN
    ALTER TABLE restraint_observation_records 
    ADD COLUMN used_restraints jsonb;
  END IF;
END $$;

-- 4. 為 used_restraints 欄位添加註釋
COMMENT ON COLUMN restraint_observation_records.used_restraints IS '使用的約束物品，JSON 格式存儲，例如: {"bed_rail": true, "wheelchair_belt": false, "wheelchair_table": true, ...}';
