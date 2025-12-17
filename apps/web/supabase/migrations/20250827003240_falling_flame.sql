/*
  # 創建出入院記錄表和相關欄位

  1. 新增表格
    - `patient_admission_records`
      - `id` (uuid, 主鍵)
      - `patient_id` (integer, 外鍵關聯院友主表)
      - `event_type` (admission_event_type, 事件類型枚舉)
      - `event_date` (date, 事件日期)
      - `hospital_name` (text, 醫院名稱)
      - `hospital_ward` (text, 病房)
      - `hospital_bed_number` (text, 床號)
      - `remarks` (text, 備註)
      - `created_at` (timestamptz, 創建時間)
      - `updated_at` (timestamptz, 更新時間)

  2. 新增欄位
    - 為 `院友主表` 添加 `is_hospitalized` (boolean, 是否住院中)

  3. 安全設定
    - 啟用 RLS
    - 設定已認證用戶的讀寫權限

  4. 索引
    - 為常用查詢欄位建立索引

  5. 觸發器
    - 自動更新 `updated_at` 欄位
*/

-- 創建事件類型枚舉
DO $$ BEGIN
  CREATE TYPE admission_event_type AS ENUM ('hospital_admission', 'hospital_discharge', 'transfer_out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 創建出入院記錄表
CREATE TABLE IF NOT EXISTS patient_admission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL,
  event_type admission_event_type NOT NULL,
  event_date date NOT NULL,
  hospital_name text,
  hospital_ward text,
  hospital_bed_number text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 為院友主表添加 is_hospitalized 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'is_hospitalized'
  ) THEN
    ALTER TABLE "院友主表" ADD COLUMN is_hospitalized boolean DEFAULT false;
  END IF;
END $$;

-- 建立外鍵約束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'patient_admission_records_patient_id_fkey'
  ) THEN
    ALTER TABLE patient_admission_records 
    ADD CONSTRAINT patient_admission_records_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES "院友主表"("院友id") ON DELETE CASCADE;
  END IF;
END $$;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_patient_id ON patient_admission_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_event_date ON patient_admission_records(event_date);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_event_type ON patient_admission_records(event_type);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_hospital_name ON patient_admission_records(hospital_name);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_created_at ON patient_admission_records(created_at);

-- 啟用 RLS
ALTER TABLE patient_admission_records ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 政策
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_admission_records' AND policyname = 'Allow authenticated users to read patient admission records'
  ) THEN
    CREATE POLICY "Allow authenticated users to read patient admission records"
      ON patient_admission_records
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_admission_records' AND policyname = 'Allow authenticated users to insert patient admission records'
  ) THEN
    CREATE POLICY "Allow authenticated users to insert patient admission records"
      ON patient_admission_records
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_admission_records' AND policyname = 'Allow authenticated users to update patient admission records'
  ) THEN
    CREATE POLICY "Allow authenticated users to update patient admission records"
      ON patient_admission_records
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_admission_records' AND policyname = 'Allow authenticated users to delete patient admission records'
  ) THEN
    CREATE POLICY "Allow authenticated users to delete patient admission records"
      ON patient_admission_records
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 創建更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_patient_admission_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'update_patient_admission_records_updated_at'
  ) THEN
    CREATE TRIGGER update_patient_admission_records_updated_at
      BEFORE UPDATE ON patient_admission_records
      FOR EACH ROW
      EXECUTE FUNCTION update_patient_admission_records_updated_at();
  END IF;
END $$;