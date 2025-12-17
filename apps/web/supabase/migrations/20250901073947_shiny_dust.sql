/*
  # 藥物工作流程系統

  1. 新增資料表
    - `medication_workflow_records` - 藥物工作流程記錄
      - `id` (uuid, 主鍵)
      - `prescription_id` (uuid, 外來鍵)
      - `patient_id` (integer, 外來鍵)
      - `scheduled_date` (date, 排程日期)
      - `scheduled_time` (time, 排程時間)
      - `preparation_status` (enum, 執藥狀態)
      - `verification_status` (enum, 核藥狀態)
      - `dispensing_status` (enum, 派藥狀態)
      - `preparation_staff` (text, 執藥人員)
      - `verification_staff` (text, 核藥人員)
      - `dispensing_staff` (text, 派藥人員)
      - `preparation_time` (timestamptz, 執藥時間)
      - `verification_time` (timestamptz, 核藥時間)
      - `dispensing_time` (timestamptz, 派藥時間)
      - `dispensing_failure_reason` (enum, 未能派發原因)
      - `custom_failure_reason` (text, 自訂未能派發原因)
      - `notes` (text, 備註)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `medication_workflow_settings` - 藥物工作流程設定
      - `id` (uuid, 主鍵)
      - `user_id` (uuid, 使用者ID)
      - `enable_one_click_functions` (boolean, 啟用一鍵功能)
      - `enable_immediate_preparation_alerts` (boolean, 啟用即時備藥提示)
      - `auto_jump_to_next_patient` (boolean, 自動跳轉下一位院友)
      - `default_preparation_lead_time` (integer, 預設備藥提前時間(分鐘))
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. 列舉類型
    - `workflow_status_enum` - 工作流程狀態
    - `dispensing_failure_reason_enum` - 未能派發原因

  3. 安全性
    - 啟用 RLS
    - 新增適當的政策
*/

-- 建立列舉類型
CREATE TYPE workflow_status_enum AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE dispensing_failure_reason_enum AS ENUM ('回家', '入院', '拒服', '略去', '藥物不足', '其他');

-- 建立藥物工作流程記錄表
CREATE TABLE IF NOT EXISTS medication_workflow_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL,
  patient_id integer NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  preparation_status workflow_status_enum DEFAULT 'pending',
  verification_status workflow_status_enum DEFAULT 'pending',
  dispensing_status workflow_status_enum DEFAULT 'pending',
  preparation_staff text,
  verification_staff text,
  dispensing_staff text,
  preparation_time timestamptz,
  verification_time timestamptz,
  dispensing_time timestamptz,
  dispensing_failure_reason dispensing_failure_reason_enum,
  custom_failure_reason text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 建立藥物工作流程設定表
CREATE TABLE IF NOT EXISTS medication_workflow_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  enable_one_click_functions boolean DEFAULT true,
  enable_immediate_preparation_alerts boolean DEFAULT true,
  auto_jump_to_next_patient boolean DEFAULT false,
  default_preparation_lead_time integer DEFAULT 60,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_medication_workflow_records_prescription_id ON medication_workflow_records(prescription_id);
CREATE INDEX IF NOT EXISTS idx_medication_workflow_records_patient_id ON medication_workflow_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_workflow_records_scheduled_date ON medication_workflow_records(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_medication_workflow_records_scheduled_time ON medication_workflow_records(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_medication_workflow_records_preparation_status ON medication_workflow_records(preparation_status);
CREATE INDEX IF NOT EXISTS idx_medication_workflow_records_verification_status ON medication_workflow_records(verification_status);
CREATE INDEX IF NOT EXISTS idx_medication_workflow_records_dispensing_status ON medication_workflow_records(dispensing_status);
CREATE INDEX IF NOT EXISTS idx_medication_workflow_settings_user_id ON medication_workflow_settings(user_id);

-- 建立外來鍵約束
ALTER TABLE medication_workflow_records 
ADD CONSTRAINT fk_medication_workflow_prescription 
FOREIGN KEY (prescription_id) REFERENCES medication_prescriptions(id) ON DELETE CASCADE;

ALTER TABLE medication_workflow_records 
ADD CONSTRAINT fk_medication_workflow_patient 
FOREIGN KEY (patient_id) REFERENCES "院友主表"("院友id") ON DELETE CASCADE;

-- 啟用 RLS
ALTER TABLE medication_workflow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_workflow_settings ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 政策
CREATE POLICY "允許已認證用戶管理藥物工作流程記錄"
  ON medication_workflow_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶管理藥物工作流程設定"
  ON medication_workflow_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 建立更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_medication_workflow_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_medication_workflow_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
CREATE TRIGGER update_medication_workflow_records_updated_at
  BEFORE UPDATE ON medication_workflow_records
  FOR EACH ROW
  EXECUTE FUNCTION update_medication_workflow_records_updated_at();

CREATE TRIGGER update_medication_workflow_settings_updated_at
  BEFORE UPDATE ON medication_workflow_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_medication_workflow_settings_updated_at();