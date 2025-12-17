/*
  # 創建出入院記錄表

  1. 新增表格
    - `patient_admission_records`
      - `id` (uuid, 主鍵)
      - `patient_id` (integer, 外鍵關聯院友主表)
      - `event_type` (enum, 事件類型: 入院/出院/轉院)
      - `event_date` (date, 事件日期)
      - `hospital_name` (text, 醫院名稱)
      - `hospital_ward` (text, 病房)
      - `hospital_bed_number` (text, 醫院床號)
      - `remarks` (text, 備註)
      - `created_at` (timestamptz, 創建時間)
      - `updated_at` (timestamptz, 更新時間)

  2. 安全設定
    - 啟用 RLS
    - 新增已認證用戶的 CRUD 政策

  3. 索引
    - 為常用查詢欄位建立索引
*/

-- 創建事件類型枚舉
CREATE TYPE IF NOT EXISTS admission_event_type AS ENUM (
  'hospital_admission',
  'hospital_discharge', 
  'transfer_out'
);

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

-- 新增外鍵約束
ALTER TABLE patient_admission_records 
ADD CONSTRAINT IF NOT EXISTS fk_patient_admission_records_patient_id 
FOREIGN KEY (patient_id) REFERENCES "院友主表"("院友id") ON DELETE CASCADE;

-- 啟用 RLS
ALTER TABLE patient_admission_records ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 政策
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read patient admission records"
  ON patient_admission_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated users to insert patient admission records"
  ON patient_admission_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated users to update patient admission records"
  ON patient_admission_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete patient admission records"
  ON patient_admission_records
  FOR DELETE
  TO authenticated
  USING (true);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_patient_id 
ON patient_admission_records (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_admission_records_event_date 
ON patient_admission_records (event_date);

CREATE INDEX IF NOT EXISTS idx_patient_admission_records_event_type 
ON patient_admission_records (event_type);

CREATE INDEX IF NOT EXISTS idx_patient_admission_records_hospital_name 
ON patient_admission_records (hospital_name);

CREATE INDEX IF NOT EXISTS idx_patient_admission_records_created_at 
ON patient_admission_records (created_at);

-- 創建更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_patient_admission_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
CREATE TRIGGER IF NOT EXISTS update_patient_admission_records_updated_at
  BEFORE UPDATE ON patient_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_admission_records_updated_at();