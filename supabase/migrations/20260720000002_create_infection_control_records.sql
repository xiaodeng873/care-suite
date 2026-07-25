/*
  # 創建感染控制記錄資料表

  ## 新增資料表
  - `infection_control_records` - 感染控制記錄表
    - `id` (uuid, primary key) - 記錄ID
    - `patient_id` (integer, foreign key) - 院友ID，關聯到院友主表
    - `infection_type` (text) - 感染性質（如 MRSA、CPE、VRE 等）
    - `diagnosis_date` (date) - 確診日期（未知時預設 1900-01-01）
    - `recovery_date` (date, optional) - 康復日期
    - `created_at` (timestamptz) - 記錄創建時間
    - `updated_at` (timestamptz) - 記錄更新時間

  ## 安全性設置
  - 啟用 RLS (Row Level Security)
  - 為 authenticated 用戶添加完整的 CRUD 權限策略
  - 添加索引以優化查詢性能

  ## 業務邏輯
  - 從院友主表的 `感染控制` JSONB 陣列遷移既有資料
  - 每個感染控制項目成為一筆獨立記錄
  - 保持床位表、報表查詢、統計報表、年度體檢對感染控制資料的引用
*/

-- 創建感染控制記錄表
CREATE TABLE IF NOT EXISTS infection_control_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  infection_type text NOT NULL,
  diagnosis_date date NOT NULL DEFAULT '1900-01-01',
  recovery_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 創建索引以優化查詢性能
CREATE INDEX IF NOT EXISTS idx_infection_control_records_patient_id ON infection_control_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_infection_control_records_diagnosis_date ON infection_control_records(diagnosis_date);
CREATE INDEX IF NOT EXISTS idx_infection_control_records_recovery_date ON infection_control_records(recovery_date);
CREATE INDEX IF NOT EXISTS idx_infection_control_records_created_at ON infection_control_records(created_at);

-- 創建更新時間觸發器
CREATE OR REPLACE FUNCTION update_infection_control_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_infection_control_records_updated_at ON infection_control_records;

CREATE TRIGGER trigger_update_infection_control_records_updated_at BEFORE UPDATE ON infection_control_records
  FOR EACH ROW
  EXECUTE FUNCTION update_infection_control_records_updated_at();

-- 啟用 Row Level Security
ALTER TABLE infection_control_records ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略：允許所有已認證用戶查看感染控制記錄
DROP POLICY IF EXISTS "Allow authenticated users to view infection control records" ON infection_control_records;
CREATE POLICY "Allow authenticated users to view infection control records" ON infection_control_records
  FOR SELECT
  TO authenticated
  USING (true);

-- 創建 RLS 策略：允許所有已認證用戶新增感染控制記錄
DROP POLICY IF EXISTS "Allow authenticated users to insert infection control records" ON infection_control_records;
CREATE POLICY "Allow authenticated users to insert infection control records" ON infection_control_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 創建 RLS 策略：允許所有已認證用戶更新感染控制記錄
DROP POLICY IF EXISTS "Allow authenticated users to update infection control records" ON infection_control_records;
CREATE POLICY "Allow authenticated users to update infection control records" ON infection_control_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 創建 RLS 策略：允許所有已認證用戶刪除感染控制記錄
DROP POLICY IF EXISTS "Allow authenticated users to delete infection control records" ON infection_control_records;
CREATE POLICY "Allow authenticated users to delete infection control records" ON infection_control_records
  FOR DELETE
  TO authenticated
  USING (true);

-- 從院友主表遷移既有感染控制資料
-- 每個 JSONB 陣列元素成為一筆記錄，未知確診日期使用 1900-01-01，康復日期留空
INSERT INTO infection_control_records (patient_id, infection_type, diagnosis_date, recovery_date)
SELECT
  "院友id",
  jsonb_array_elements_text("感染控制") AS infection_type,
  '1900-01-01'::date AS diagnosis_date,
  NULL AS recovery_date
FROM "院友主表"
WHERE "感染控制" IS NOT NULL
  AND jsonb_array_length("感染控制") > 0
ON CONFLICT DO NOTHING;

-- 新增感染控制權限到日常類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  ('daily', 'infection_control', '感染控制', 'view', '/infection-control'),
  ('daily', 'infection_control', '感染控制', 'create', '/infection-control'),
  ('daily', 'infection_control', '感染控制', 'edit', '/infection-control'),
  ('daily', 'infection_control', '感染控制', 'delete', '/infection-control')
ON CONFLICT (category, feature, action) DO NOTHING;
