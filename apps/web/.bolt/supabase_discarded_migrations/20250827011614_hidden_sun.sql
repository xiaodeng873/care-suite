/*
  # 建立增強版出入院記錄系統

  1. 新增表格
    - `patient_admission_records` - 出入院記錄主表
      - `id` (uuid, 主鍵)
      - `patient_id` (integer, 外鍵至院友主表)
      - `event_type` (enum: hospital_admission, hospital_discharge, transfer_out)
      - `event_date` (date, 事件日期)
      - `event_time` (time, 事件時間)
      - `hospital_name` (text, 醫院名稱)
      - `hospital_ward` (text, 病房)
      - `hospital_bed_number` (text, 醫院床號)
      - `discharge_type` (enum: home, transfer_out, deceased)
      - `date_of_death` (date, 離世日期)
      - `time_of_death` (time, 離世時間)
      - `transfer_to_facility_name` (text, 轉入機構名稱)
      - `transfer_to_facility_address` (text, 轉入機構地址)
      - `remarks` (text, 備註)
      - `created_at`, `updated_at` (timestamps)

    - `patient_hospital_transfers` - 轉院路徑表
      - `id` (uuid, 主鍵)
      - `admission_record_id` (uuid, 外鍵至出入院記錄)
      - `transfer_location` (text, 轉院地點)
      - `transfer_date` (date, 轉院日期)
      - `transfer_time` (time, 轉院時間)
      - `transfer_order` (integer, 轉院順序)
      - `remarks` (text, 備註)
      - `created_at`, `updated_at` (timestamps)

  2. 新增枚舉類型
    - `discharge_type` - 出院類型 (home, transfer_out, deceased)

  3. 新增欄位至現有表格
    - 為 `院友主表` 新增 `is_hospitalized` (boolean) 欄位

  4. 安全性
    - 啟用所有表格的 RLS
    - 為已認證用戶新增適當的政策

  5. 索引
    - 為常用查詢欄位建立索引以提升效能

  6. 觸發器
    - 自動更新 updated_at 欄位
*/

-- 建立出院類型枚舉
DO $$ BEGIN
  CREATE TYPE discharge_type AS ENUM ('home', 'transfer_out', 'deceased');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 建立出入院記錄主表
CREATE TABLE IF NOT EXISTS patient_admission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL,
  event_type admission_event_type NOT NULL,
  event_date date NOT NULL,
  event_time time DEFAULT CURRENT_TIME,
  hospital_name text,
  hospital_ward text,
  hospital_bed_number text,
  discharge_type discharge_type,
  date_of_death date,
  time_of_death time,
  transfer_to_facility_name text,
  transfer_to_facility_address text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 建立轉院路徑表
CREATE TABLE IF NOT EXISTS patient_hospital_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_record_id uuid NOT NULL,
  transfer_location text NOT NULL,
  transfer_date date NOT NULL,
  transfer_time time NOT NULL,
  transfer_order integer NOT NULL DEFAULT 1,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 為院友主表新增住院狀態欄位
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
  -- 出入院記錄表的外鍵
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'patient_admission_records_patient_id_fkey'
  ) THEN
    ALTER TABLE patient_admission_records 
    ADD CONSTRAINT patient_admission_records_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES "院友主表"("院友id") ON DELETE CASCADE;
  END IF;

  -- 轉院路徑表的外鍵
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'patient_hospital_transfers_admission_record_id_fkey'
  ) THEN
    ALTER TABLE patient_hospital_transfers 
    ADD CONSTRAINT patient_hospital_transfers_admission_record_id_fkey 
    FOREIGN KEY (admission_record_id) REFERENCES patient_admission_records(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_patient_id ON patient_admission_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_event_date ON patient_admission_records(event_date);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_event_type ON patient_admission_records(event_type);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_hospital_name ON patient_admission_records(hospital_name);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_created_at ON patient_admission_records(created_at);

CREATE INDEX IF NOT EXISTS idx_patient_hospital_transfers_admission_record_id ON patient_hospital_transfers(admission_record_id);
CREATE INDEX IF NOT EXISTS idx_patient_hospital_transfers_transfer_date ON patient_hospital_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_patient_hospital_transfers_transfer_order ON patient_hospital_transfers(transfer_order);

-- 啟用 RLS
ALTER TABLE patient_admission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_hospital_transfers ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 政策 - 出入院記錄表
CREATE POLICY "Allow authenticated users to read patient admission records"
  ON patient_admission_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert patient admission records"
  ON patient_admission_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update patient admission records"
  ON patient_admission_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete patient admission records"
  ON patient_admission_records
  FOR DELETE
  TO authenticated
  USING (true);

-- 建立 RLS 政策 - 轉院路徑表
CREATE POLICY "Allow authenticated users to read patient hospital transfers"
  ON patient_hospital_transfers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert patient hospital transfers"
  ON patient_hospital_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update patient hospital transfers"
  ON patient_hospital_transfers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete patient hospital transfers"
  ON patient_hospital_transfers
  FOR DELETE
  TO authenticated
  USING (true);

-- 建立觸發器函數
CREATE OR REPLACE FUNCTION update_patient_admission_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_patient_hospital_transfers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
DROP TRIGGER IF EXISTS update_patient_admission_records_updated_at ON patient_admission_records;
CREATE TRIGGER update_patient_admission_records_updated_at
  BEFORE UPDATE ON patient_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_admission_records_updated_at();

DROP TRIGGER IF EXISTS update_patient_hospital_transfers_updated_at ON patient_hospital_transfers;
CREATE TRIGGER update_patient_hospital_transfers_updated_at
  BEFORE UPDATE ON patient_hospital_transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_hospital_transfers_updated_at();