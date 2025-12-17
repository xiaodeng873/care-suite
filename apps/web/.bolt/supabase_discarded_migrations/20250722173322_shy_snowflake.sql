/*
  # 建立院友健康任務表格

  1. 新增表格
    - `patient_health_tasks` - 儲存院友健康監測任務
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key to 院友主表)
      - `health_record_type` (enum: 生命表徵, 血糖控制, 體重控制, 約束物品同意書, 年度體檢)
      - `frequency_unit` (enum: daily, weekly, monthly)
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
    - 設定適當的存取權限政策
*/

-- 建立健康任務類型枚舉
CREATE TYPE health_task_type AS ENUM ('生命表徵', '血糖控制', '體重控制', '約束物品同意書', '年度體檢');

-- 建立頻率單位枚舉
CREATE TYPE frequency_unit AS ENUM ('daily', 'weekly', 'monthly');

-- 建立院友健康任務表格
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

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_patient_health_tasks_patient_id ON patient_health_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_health_tasks_next_due_at ON patient_health_tasks(next_due_at);
CREATE INDEX IF NOT EXISTS idx_patient_health_tasks_health_record_type ON patient_health_tasks(health_record_type);

-- 設定 RLS 政策
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

-- 創建自動更新時間戳觸發器
CREATE TRIGGER update_patient_health_tasks_updated_at
    BEFORE UPDATE ON patient_health_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();