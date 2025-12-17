/*
  # 處方管理系統

  1. 新增資料表
    - `medication_prescriptions` (藥物處方主表)
      - 包含完整的處方資訊，支援多種服用頻率和備藥方式
    - `medication_inspection_rules` (藥物檢測規則表)
      - 設定檢測項條件，如血糖值小於6.0不得派發
    - `medication_risk_rules` (藥物風險規則表)
      - 定義藥物衝突、時段不符等風險規則
    - `medication_prescription_history` (處方歷史記錄表)
      - 追蹤處方變更歷史
    - `medication_time_slot_definitions` (服用時段定義表)
      - 自定義服用時段的時間範圍

  2. 安全設定
    - 啟用所有資料表的 RLS
    - 設定適當的存取政策
    - 建立必要的索引以提升效能

  3. 預設資料
    - 插入常用的服用時段定義
    - 插入基本的風險規則範例
*/

-- 建立服用頻率類型枚舉
CREATE TYPE medication_frequency_type AS ENUM (
  'daily',
  'every_x_days', 
  'every_x_months',
  'weekly_days',
  'odd_even_days'
);

-- 建立單雙日服枚舉
CREATE TYPE odd_even_day_type AS ENUM (
  'odd',
  'even', 
  'none'
);

-- 建立備藥方式枚舉
CREATE TYPE preparation_method_type AS ENUM (
  'immediate',
  'advanced',
  'custom'
);

-- 建立處方狀態枚舉
CREATE TYPE prescription_status_type AS ENUM (
  'active',
  'inactive',
  'pending_change'
);

-- 建立檢測項目枚舉
CREATE TYPE vital_sign_type AS ENUM (
  '上壓',
  '下壓', 
  '脈搏',
  '血糖值',
  '呼吸',
  '血含氧量',
  '體溫'
);

-- 建立條件操作符枚舉
CREATE TYPE condition_operator_type AS ENUM (
  'gt',
  'lt',
  'gte',
  'lte'
);

-- 建立風險規則類型枚舉
CREATE TYPE risk_rule_type AS ENUM (
  'drug_conflict',
  'timing_mismatch',
  'dosage_anomaly',
  'other'
);

-- 1. 服用時段定義表
CREATE TABLE IF NOT EXISTS medication_time_slot_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_name text NOT NULL UNIQUE,
  start_time time,
  end_time time,
  is_meal_related boolean DEFAULT false,
  meal_type text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 藥物處方主表
CREATE TABLE IF NOT EXISTS medication_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  medication_name text NOT NULL,
  prescription_date date NOT NULL,
  start_date date NOT NULL,
  start_time time,
  end_date date,
  end_time time,
  dosage_form text,
  administration_route text,
  dosage_amount text,
  frequency_type medication_frequency_type NOT NULL DEFAULT 'daily',
  frequency_value integer DEFAULT 1,
  specific_weekdays jsonb DEFAULT '[]'::jsonb,
  is_odd_even_day odd_even_day_type DEFAULT 'none',
  is_prn boolean DEFAULT false,
  medication_time_slots jsonb DEFAULT '[]'::jsonb,
  notes text,
  preparation_method preparation_method_type DEFAULT 'advanced',
  status prescription_status_type DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. 藥物檢測規則表
CREATE TABLE IF NOT EXISTS medication_inspection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES medication_prescriptions(id) ON DELETE CASCADE,
  vital_sign_type vital_sign_type NOT NULL,
  condition_operator condition_operator_type NOT NULL,
  condition_value numeric NOT NULL,
  action_if_met text DEFAULT 'block_dispensing',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. 藥物風險規則表
CREATE TABLE IF NOT EXISTS medication_risk_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL UNIQUE,
  rule_type risk_rule_type NOT NULL,
  rule_details jsonb DEFAULT '{}'::jsonb,
  warning_message text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. 處方歷史記錄表
CREATE TABLE IF NOT EXISTS medication_prescription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES medication_prescriptions(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  change_details jsonb DEFAULT '{}'::jsonb,
  changed_by text,
  change_timestamp timestamptz DEFAULT now()
);

-- 建立索引以提升效能
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_patient_id ON medication_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_medication_name ON medication_prescriptions(medication_name);
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_prescription_date ON medication_prescriptions(prescription_date);
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_start_date ON medication_prescriptions(start_date);
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_end_date ON medication_prescriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_status ON medication_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_frequency_type ON medication_prescriptions(frequency_type);
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_time_slots ON medication_prescriptions USING gin(medication_time_slots);

CREATE INDEX IF NOT EXISTS idx_medication_inspection_rules_prescription_id ON medication_inspection_rules(prescription_id);
CREATE INDEX IF NOT EXISTS idx_medication_inspection_rules_vital_sign_type ON medication_inspection_rules(vital_sign_type);

CREATE INDEX IF NOT EXISTS idx_medication_risk_rules_rule_type ON medication_risk_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_medication_risk_rules_is_active ON medication_risk_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_medication_prescription_history_prescription_id ON medication_prescription_history(prescription_id);
CREATE INDEX IF NOT EXISTS idx_medication_prescription_history_version ON medication_prescription_history(version);

CREATE INDEX IF NOT EXISTS idx_medication_time_slot_definitions_slot_name ON medication_time_slot_definitions(slot_name);

-- 啟用 RLS
ALTER TABLE medication_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_inspection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_prescription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_time_slot_definitions ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 政策
CREATE POLICY "允許已認證用戶管理藥物處方"
  ON medication_prescriptions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶管理檢測規則"
  ON medication_inspection_rules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶管理風險規則"
  ON medication_risk_rules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶查看處方歷史"
  ON medication_prescription_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶管理時段定義"
  ON medication_time_slot_definitions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 建立更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_medication_prescriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_medication_time_slot_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
CREATE TRIGGER update_medication_prescriptions_updated_at
  BEFORE UPDATE ON medication_prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_medication_prescriptions_updated_at();

CREATE TRIGGER update_medication_time_slot_definitions_updated_at
  BEFORE UPDATE ON medication_time_slot_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_medication_time_slot_definitions_updated_at();

-- 插入預設服用時段定義
INSERT INTO medication_time_slot_definitions (slot_name, start_time, end_time, is_meal_related, meal_type, description) VALUES
('餐前', '07:00', '07:30', true, 'general', '一般餐前時段'),
('進餐時', '08:00', '08:30', true, 'general', '一般進餐時段'),
('餐後', '08:30', '09:00', true, 'general', '一般餐後時段'),
('早餐前', '07:00', '07:30', true, 'breakfast', '早餐前時段'),
('早餐時', '08:00', '08:30', true, 'breakfast', '早餐時段'),
('早餐後', '08:30', '09:00', true, 'breakfast', '早餐後時段'),
('午餐前', '11:30', '12:00', true, 'lunch', '午餐前時段'),
('午餐時', '12:00', '12:30', true, 'lunch', '午餐時段'),
('午餐後', '12:30', '13:00', true, 'lunch', '午餐後時段'),
('晚餐前', '17:30', '18:00', true, 'dinner', '晚餐前時段'),
('晚餐時', '18:00', '18:30', true, 'dinner', '晚餐時段'),
('晚餐後', '18:30', '19:00', true, 'dinner', '晚餐後時段'),
('早上', '06:00', '12:00', false, null, '早上時段'),
('晚上', '18:00', '22:00', false, null, '晚上時段'),
('睡前', '21:00', '22:00', false, null, '睡前時段')
ON CONFLICT (slot_name) DO NOTHING;

-- 插入預設風險規則範例
INSERT INTO medication_risk_rules (rule_name, rule_type, rule_details, warning_message) VALUES
('餐前藥物時段檢查', 'timing_mismatch', '{"meal_timing": "before_meal", "allowed_slots": ["餐前", "早餐前", "午餐前", "晚餐前"]}', '餐前藥物不可安排在非餐前時段'),
('晚上藥物時段檢查', 'timing_mismatch', '{"time_category": "evening", "allowed_slots": ["晚上", "睡前", "晚餐前", "晚餐時", "晚餐後"]}', '晚上藥物不應在早上或中午時段派發'),
('高劑量警告', 'dosage_anomaly', '{"max_tablets_per_dose": 10}', '單次劑量超過10粒，請確認是否正確'),
('重複藥物檢查', 'drug_conflict', '{"check_duplicate": true}', '發現相同藥物的重複處方，請檢查是否需要')
ON CONFLICT (rule_name) DO NOTHING;