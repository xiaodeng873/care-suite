/*
  # 創建院友健康任務表

  1. 新增表格
    - `patient_health_tasks`
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key)
      - `health_record_type` (enum)
      - `frequency_unit` (enum)
      - `frequency_value` (integer)
      - `specific_times` (jsonb array)
      - `specific_days_of_week` (jsonb array)
      - `specific_days_of_month` (jsonb array)
      - `last_completed_at` (timestamptz)
      - `next_due_at` (timestamptz)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. 安全設定
    - 啟用 RLS
    - 新增已認證用戶的 CRUD 策略
*/

-- 創建健康記錄類型枚舉
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_task_type') THEN
    CREATE TYPE health_task_type AS ENUM ('生命表徵', '血糖控制', '體重控制');
  END IF;
END $$;

-- 創建頻率單位枚舉
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'frequency_unit') THEN
    CREATE TYPE frequency_unit AS ENUM ('hourly', 'daily', 'weekly', 'monthly');
  END IF;
END $$;

-- 創建院友健康任務表
CREATE TABLE IF NOT EXISTS patient_health_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES 院友主表(院友id) ON DELETE CASCADE,
  health_record_type health_task_type NOT NULL,
  frequency_unit frequency_unit NOT NULL,
  frequency_value integer NOT NULL DEFAULT 1,
  specific_times jsonb DEFAULT '[]'::jsonb,
  specific_days_of_week jsonb DEFAULT '[]'::jsonb,
  specific_days_of_month jsonb DEFAULT '[]'::jsonb,
  last_completed_at timestamptz,
  next_due_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE patient_health_tasks ENABLE ROW LEVEL SECURITY;

-- 新增索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_patient_health_tasks_patient_id ON patient_health_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_health_tasks_next_due_at ON patient_health_tasks(next_due_at);
CREATE INDEX IF NOT EXISTS idx_patient_health_tasks_health_record_type ON patient_health_tasks(health_record_type);
CREATE INDEX IF NOT EXISTS idx_patient_health_tasks_last_completed_at ON patient_health_tasks(last_completed_at);

-- 新增 RLS 策略
CREATE POLICY "允許已認證用戶讀取健康任務"
  ON patient_health_tasks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增健康任務"
  ON patient_health_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新健康任務"
  ON patient_health_tasks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除健康任務"
  ON patient_health_tasks
  FOR DELETE
  TO authenticated
  USING (true);

-- 新增觸發器以自動更新時間戳
CREATE OR REPLACE FUNCTION update_patient_health_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patient_health_tasks_updated_at
    BEFORE UPDATE ON patient_health_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_patient_health_tasks_updated_at();