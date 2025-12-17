/*
  # 增強版出入院記錄系統

  1. 新增枚舉類型
    - `admission_event_type`: 事件類型 (入院, 出院, 轉院)
    - `discharge_type`: 出院類型 (回家, 轉院, 離世)

  2. 新增表格
    - `patient_admission_records`: 出入院記錄主表
    - `patient_hospital_transfers`: 轉院路徑記錄表

  3. 安全設定
    - 啟用 RLS
    - 設定適當的存取政策

  4. 索引和觸發器
    - 建立效能索引
    - 自動更新時間戳
*/

-- 創建事件類型枚舉
DO $$ BEGIN
  CREATE TYPE admission_event_type AS ENUM ('hospital_admission', 'hospital_discharge', 'transfer_out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 創建出院類型枚舉
DO $$ BEGIN
  CREATE TYPE discharge_type AS ENUM ('home', 'transfer_out', 'deceased');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 創建出入院記錄主表
CREATE TABLE IF NOT EXISTS patient_admission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL,
  event_type admission_event_type NOT NULL,
  event_date date NOT NULL,
  event_time time without time zone NOT NULL,
  hospital_name text,
  hospital_ward text,
  hospital_bed_number text,
  discharge_type discharge_type,
  date_of_death date,
  time_of_death time without time zone,
  transfer_to_facility_name text,
  transfer_to_facility_address text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (patient_id) REFERENCES "院友主表"("院友id") ON DELETE CASCADE
);

-- 創建轉院路徑記錄表
CREATE TABLE IF NOT EXISTS patient_hospital_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_record_id uuid NOT NULL,
  transfer_location text NOT NULL,
  transfer_date date NOT NULL,
  transfer_time time without time zone NOT NULL,
  transfer_order integer NOT NULL DEFAULT 1,
  remarks text,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (admission_record_id) REFERENCES patient_admission_records(id) ON DELETE CASCADE
);

-- 為院友主表添加住院狀態欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'is_hospitalized'
  ) THEN
    ALTER TABLE "院友主表" ADD COLUMN is_hospitalized boolean DEFAULT false;
  END IF;
END $$;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_patient_id ON patient_admission_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_event_date ON patient_admission_records(event_date);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_event_type ON patient_admission_records(event_type);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_discharge_type ON patient_admission_records(discharge_type);
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_created_at ON patient_admission_records(created_at);

CREATE INDEX IF NOT EXISTS idx_patient_hospital_transfers_admission_record_id ON patient_hospital_transfers(admission_record_id);
CREATE INDEX IF NOT EXISTS idx_patient_hospital_transfers_transfer_date ON patient_hospital_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_patient_hospital_transfers_transfer_order ON patient_hospital_transfers(transfer_order);

-- 啟用 RLS
ALTER TABLE patient_admission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_hospital_transfers ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 政策
CREATE POLICY "Allow authenticated users to read admission records"
  ON patient_admission_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert admission records"
  ON patient_admission_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update admission records"
  ON patient_admission_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete admission records"
  ON patient_admission_records
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read hospital transfers"
  ON patient_hospital_transfers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert hospital transfers"
  ON patient_hospital_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update hospital transfers"
  ON patient_hospital_transfers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete hospital transfers"
  ON patient_hospital_transfers
  FOR DELETE
  TO authenticated
  USING (true);

-- 創建更新時間戳的觸發器函數（如果不存在）
CREATE OR REPLACE FUNCTION update_patient_admission_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS update_patient_admission_records_updated_at ON patient_admission_records;
CREATE TRIGGER update_patient_admission_records_updated_at
  BEFORE UPDATE ON patient_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_admission_records_updated_at();