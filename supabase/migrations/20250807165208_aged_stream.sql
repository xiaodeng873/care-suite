/*
  # 驗證約束物品評估表格結構

  檢查 patient_restraint_assessments 表格是否存在並具有正確的欄位結構。
  如果不存在則創建，確保能夠儲存所有約束物品評估資料。

  1. 表格結構
    - `id` (uuid, primary key)
    - `patient_id` (integer, foreign key)
    - `doctor_signature_date` (date, nullable)
    - `next_due_date` (date, nullable)
    - `risk_factors` (jsonb) - 儲存所有風險因素
    - `alternatives` (jsonb) - 儲存所有折衷辦法
    - `suggested_restraints` (jsonb) - 儲存所有約束物品建議
    - `other_restraint_notes` (text, nullable)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. 安全性
    - 啟用 RLS
    - 新增適當的策略

  3. 索引
    - 為常用查詢欄位新增索引
*/

-- 檢查表格是否存在，如果不存在則創建
CREATE TABLE IF NOT EXISTS patient_restraint_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  doctor_signature_date date,
  next_due_date date,
  risk_factors jsonb DEFAULT '{}'::jsonb,
  alternatives jsonb DEFAULT '{}'::jsonb,
  suggested_restraints jsonb DEFAULT '{}'::jsonb,
  other_restraint_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE patient_restraint_assessments ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略
DO $$
BEGIN
  -- 檢查策略是否已存在，如果不存在則創建
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_restraint_assessments' 
    AND policyname = 'Allow authenticated users to read patient restraint assessments'
  ) THEN
    CREATE POLICY "Allow authenticated users to read patient restraint assessments"
      ON patient_restraint_assessments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_restraint_assessments' 
    AND policyname = 'Allow authenticated users to insert patient restraint assessments'
  ) THEN
    CREATE POLICY "Allow authenticated users to insert patient restraint assessments"
      ON patient_restraint_assessments
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_restraint_assessments' 
    AND policyname = 'Allow authenticated users to update patient restraint assessments'
  ) THEN
    CREATE POLICY "Allow authenticated users to update patient restraint assessments"
      ON patient_restraint_assessments
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_restraint_assessments' 
    AND policyname = 'Allow authenticated users to delete patient restraint assessments'
  ) THEN
    CREATE POLICY "Allow authenticated users to delete patient restraint assessments"
      ON patient_restraint_assessments
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_patient_restraint_assessments_patient_id 
  ON patient_restraint_assessments (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_restraint_assessments_doctor_signature_date 
  ON patient_restraint_assessments (doctor_signature_date);

CREATE INDEX IF NOT EXISTS idx_patient_restraint_assessments_next_due_date 
  ON patient_restraint_assessments (next_due_date);

CREATE INDEX IF NOT EXISTS idx_patient_restraint_assessments_created_at 
  ON patient_restraint_assessments (created_at);

-- 創建 updated_at 自動更新觸發器
CREATE OR REPLACE FUNCTION update_patient_restraint_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 檢查觸發器是否已存在，如果不存在則創建
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_patient_restraint_assessments_updated_at'
  ) THEN
    CREATE TRIGGER update_patient_restraint_assessments_updated_at
      BEFORE UPDATE ON patient_restraint_assessments
      FOR EACH ROW
      EXECUTE FUNCTION update_patient_restraint_assessments_updated_at();
  END IF;
END $$;