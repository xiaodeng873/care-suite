/*
  # 添加出入院記錄欄位

  1. 新增欄位
    - `discharge_type` (discharge_type enum) - 出院類型
    - `date_of_death` (date) - 離世日期
    - `time_of_death` (time) - 離世時間
    - `transfer_to_facility_name` (text) - 轉入機構名稱
    - `transfer_to_facility_address` (text) - 轉入機構地址
    - `transfer_paths` (jsonb) - 轉院路徑資料

  2. 安全性
    - 所有新欄位都設為可選，不會影響現有資料
*/

-- 添加出院類型欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_admission_records' AND column_name = 'discharge_type'
  ) THEN
    ALTER TABLE patient_admission_records ADD COLUMN discharge_type discharge_type;
  END IF;
END $$;

-- 添加離世日期欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_admission_records' AND column_name = 'date_of_death'
  ) THEN
    ALTER TABLE patient_admission_records ADD COLUMN date_of_death date;
  END IF;
END $$;

-- 添加離世時間欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_admission_records' AND column_name = 'time_of_death'
  ) THEN
    ALTER TABLE patient_admission_records ADD COLUMN time_of_death time without time zone;
  END IF;
END $$;

-- 添加轉入機構名稱欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_admission_records' AND column_name = 'transfer_to_facility_name'
  ) THEN
    ALTER TABLE patient_admission_records ADD COLUMN transfer_to_facility_name text;
  END IF;
END $$;

-- 添加轉入機構地址欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_admission_records' AND column_name = 'transfer_to_facility_address'
  ) THEN
    ALTER TABLE patient_admission_records ADD COLUMN transfer_to_facility_address text;
  END IF;
END $$;

-- 添加轉院路徑資料欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_admission_records' AND column_name = 'transfer_paths'
  ) THEN
    ALTER TABLE patient_admission_records ADD COLUMN transfer_paths jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 添加事件時間欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_admission_records' AND column_name = 'event_time'
  ) THEN
    ALTER TABLE patient_admission_records ADD COLUMN event_time time without time zone;
  END IF;
END $$;

-- 為新欄位建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_discharge_type 
ON patient_admission_records(discharge_type);

CREATE INDEX IF NOT EXISTS idx_patient_admission_records_date_of_death 
ON patient_admission_records(date_of_death);

CREATE INDEX IF NOT EXISTS idx_patient_admission_records_transfer_paths 
ON patient_admission_records USING gin(transfer_paths);