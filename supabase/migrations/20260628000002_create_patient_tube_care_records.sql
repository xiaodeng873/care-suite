/*
  # 建立喉管護理記錄表 patient_tube_care_records

  將「導尿管更換」「鼻胃飼管更換」「氧氣喉管清洗/更換」三類從任務管理
  (patient_health_tasks) 抽離為獨立表，每次執行 INSERT 一列以保留歷史。

  1. 新增表格 patient_tube_care_records
     - id (uuid, PK)
     - patient_id (integer) 對應 院友主表.院友id
     - care_type (text) 三類之一
     - execution_date (date) 執行日期
     - next_due_date (date) 下次到期日（依類型自動計算）
     - tube_material (text) 導尿管/鼻胃飼管：Latex / Silicon
     - tube_size (text) 導尿管/鼻胃飼管：Fr.8-18
     - oxygen_action (text) 氧氣：清洗 / 更換
     - cycle_days (integer) 間隔天數（氧氣動作間隔；導尿管/鼻胃飼管亦可存 +14/+28）
     - notes (text)
     - created_at / updated_at (timestamptz)

  2. 資料遷移
     - 從 patient_health_tasks 將三類記錄複製到新表（每位院友每類最新一筆）
     - 完成後刪除 patient_health_tasks 中該三類記錄

  3. 安全性
     - 啟用 RLS，比照其他表新增 {anon, authenticated} 全權限政策（App 採自訂登入，以 anon 角色查詢）

  4. 索引
     - patient_id、next_due_date、care_type
*/

-- 建立喉管護理記錄表
CREATE TABLE IF NOT EXISTS patient_tube_care_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL,
  care_type text NOT NULL CHECK (care_type IN ('導尿管更換', '鼻胃飼管更換', '氧氣喉管清洗/更換')),
  execution_date date NOT NULL,
  next_due_date date,
  tube_material text,
  tube_size text,
  oxygen_action text CHECK (oxygen_action IS NULL OR oxygen_action IN ('清洗', '更換')),
  cycle_days integer,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tube_care_patient_id ON patient_tube_care_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_tube_care_next_due_date ON patient_tube_care_records(next_due_date);
CREATE INDEX IF NOT EXISTS idx_tube_care_care_type ON patient_tube_care_records(care_type);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION set_tube_care_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tube_care_updated_at ON patient_tube_care_records;
CREATE TRIGGER trg_tube_care_updated_at
  BEFORE UPDATE ON patient_tube_care_records
  FOR EACH ROW EXECUTE FUNCTION set_tube_care_updated_at();

-- 資料遷移：從 patient_health_tasks 複製三類記錄（每位院友每類最新一筆）
INSERT INTO patient_tube_care_records (
  patient_id, care_type, execution_date, next_due_date, tube_material, tube_size, notes
)
SELECT DISTINCT ON (patient_id, health_record_type)
  patient_id,
  health_record_type,
  COALESCE(last_completed_at::date, next_due_at::date, created_at::date),
  next_due_at::date,
  tube_type,
  tube_size,
  notes
FROM patient_health_tasks
WHERE health_record_type IN ('導尿管更換', '鼻胃飼管更換', '氧氣喉管清洗/更換')
  AND patient_id IS NOT NULL
ORDER BY patient_id, health_record_type, created_at DESC;

-- 刪除任務管理中該三類記錄
DELETE FROM patient_health_tasks
WHERE health_record_type IN ('導尿管更換', '鼻胃飼管更換', '氧氣喉管清洗/更換');

-- 啟用 RLS
ALTER TABLE patient_tube_care_records ENABLE ROW LEVEL SECURITY;

-- RLS 政策：anon 與 authenticated 全權限（比照院友主表 / 健康監測記錄）
DROP POLICY IF EXISTS "Allow all access patient_tube_care_records" ON patient_tube_care_records;
CREATE POLICY "Allow all access patient_tube_care_records"
  ON patient_tube_care_records FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
