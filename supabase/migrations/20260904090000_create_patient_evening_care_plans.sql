/*
  # 晚晴計劃記錄表格

  檢查 patient_evening_care_plans 表格是否存在並具有正確的欄位結構。
  如果不存在則創建，確保能夠儲存院友的晚晴計劃（ACP/AMD/DNACPR）文件到期日資料。

  1. 表格結構
    - `id` (uuid, primary key)
    - `patient_id` (integer, foreign key)
    - `acp_date` (date, nullable) - ACP 文件到期日
    - `amd_date` (date, nullable) - AMD 文件到期日
    - `dnacpr_date` (date, nullable) - DNACPR 文件到期日
    - `notes` (text, nullable)
    - `is_terminated` (boolean, NOT NULL DEFAULT false)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. 安全性
    - 啟用 RLS
    - 新增適當的策略（SELECT/INSERT/UPDATE/DELETE）

  3. 索引
    - 為常用查詢欄位新增索引
*/

-- 檢查表格是否存在，如果不存在則創建
CREATE TABLE IF NOT EXISTS patient_evening_care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  acp_date date,
  amd_date date,
  dnacpr_date date,
  notes text,
  is_terminated boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE patient_evening_care_plans ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略
DO $$
BEGIN
  -- 檢查策略是否已存在，如果不存在則創建
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patient_evening_care_plans'
    AND policyname = 'Allow authenticated users to read patient evening care plans'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to read patient evening care plans" ON patient_evening_care_plans;

    CREATE POLICY "Allow authenticated users to read patient evening care plans" ON patient_evening_care_plans
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patient_evening_care_plans'
    AND policyname = 'Allow authenticated users to insert patient evening care plans'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to insert patient evening care plans" ON patient_evening_care_plans;

    CREATE POLICY "Allow authenticated users to insert patient evening care plans" ON patient_evening_care_plans
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patient_evening_care_plans'
    AND policyname = 'Allow authenticated users to update patient evening care plans'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to update patient evening care plans" ON patient_evening_care_plans;

    CREATE POLICY "Allow authenticated users to update patient evening care plans" ON patient_evening_care_plans
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patient_evening_care_plans'
    AND policyname = 'Allow authenticated users to delete patient evening care plans'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to delete patient evening care plans" ON patient_evening_care_plans;

    CREATE POLICY "Allow authenticated users to delete patient evening care plans" ON patient_evening_care_plans
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_patient_evening_care_plans_patient_id
  ON patient_evening_care_plans (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_evening_care_plans_is_terminated
  ON patient_evening_care_plans (is_terminated);

-- 創建 updated_at 自動更新觸發器
CREATE OR REPLACE FUNCTION update_patient_evening_care_plans_updated_at()
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
    WHERE tgname = 'update_patient_evening_care_plans_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_patient_evening_care_plans_updated_at ON patient_evening_care_plans;

    CREATE TRIGGER update_patient_evening_care_plans_updated_at BEFORE UPDATE ON patient_evening_care_plans
      FOR EACH ROW
      EXECUTE FUNCTION update_patient_evening_care_plans_updated_at();
  END IF;
END $$;
