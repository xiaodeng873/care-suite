/*
  # 藥物工作流程系統（包含檢測結果字段）

  ## 說明
  創建藥物工作流程相關表，包含派藥前檢測結果字段

  ## 變更內容
  1. 新增資料表
    - `medication_workflow_records` - 藥物工作流程記錄
    - `medication_workflow_settings` - 藥物工作流程設定

  2. 列舉類型
    - `workflow_status_enum` - 工作流程狀態
    - `dispensing_failure_reason_enum` - 未能派發原因

  3. 安全性
    - 啟用 RLS
    - 新增適當的政策
*/

-- 建立列舉類型（如果不存在）
DO $$ BEGIN
  CREATE TYPE workflow_status_enum AS ENUM ('pending', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE dispensing_failure_reason_enum AS ENUM ('回家', '入院', '拒服', '略去', '藥物不足', '其他');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
  inspection_check_result jsonb,
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

-- 啟用 RLS
ALTER TABLE medication_workflow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_workflow_settings ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 政策
DO $$ BEGIN
  CREATE POLICY "允許已認證用戶管理藥物工作流程記錄"
    ON medication_workflow_records
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "允許已認證用戶管理藥物工作流程設定"
    ON medication_workflow_settings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
DROP TRIGGER IF EXISTS update_medication_workflow_records_updated_at ON medication_workflow_records;
CREATE TRIGGER update_medication_workflow_records_updated_at
  BEFORE UPDATE ON medication_workflow_records
  FOR EACH ROW
  EXECUTE FUNCTION update_medication_workflow_records_updated_at();

DROP TRIGGER IF EXISTS update_medication_workflow_settings_updated_at ON medication_workflow_settings;
CREATE TRIGGER update_medication_workflow_settings_updated_at
  BEFORE UPDATE ON medication_workflow_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_medication_workflow_settings_updated_at();