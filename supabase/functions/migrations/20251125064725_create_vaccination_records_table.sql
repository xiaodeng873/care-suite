/*
  # 創建疫苗記錄資料表

  ## 新增資料表
  - `vaccination_records` - 疫苗記錄表
    - `id` (uuid, primary key) - 記錄ID
    - `patient_id` (integer, foreign key) - 院友ID，關聯到院友主表
    - `vaccination_date` (date) - 注射日期
    - `vaccine_item` (text) - 疫苗項目/疫苗名稱
    - `vaccination_unit` (text) - 注射單位/醫院/診所名稱
    - `remarks` (text, optional) - 備註
    - `created_at` (timestamptz) - 記錄創建時間
    - `updated_at` (timestamptz) - 記錄更新時間
    - `created_by` (uuid) - 創建者ID

  ## 安全性設置
  - 啟用 RLS (Row Level Security)
  - 為authenticated用戶添加完整的CRUD權限策略
  - 添加索引以優化查詢性能

  ## 業務邏輯
  - 支援在住、待入住、已退住院友的疫苗記錄管理
  - 記錄院友的疫苗注射歷史
  - 可追蹤疫苗注射的醫療單位來源
*/

-- 創建疫苗記錄表
CREATE TABLE IF NOT EXISTS vaccination_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  vaccination_date date NOT NULL,
  vaccine_item text NOT NULL,
  vaccination_unit text NOT NULL,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 創建索引以優化查詢性能
CREATE INDEX IF NOT EXISTS idx_vaccination_records_patient_id ON vaccination_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_vaccination_date ON vaccination_records(vaccination_date);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_created_at ON vaccination_records(created_at);

-- 創建更新時間觸發器
CREATE OR REPLACE FUNCTION update_vaccination_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vaccination_records_updated_at
  BEFORE UPDATE ON vaccination_records
  FOR EACH ROW
  EXECUTE FUNCTION update_vaccination_records_updated_at();

-- 啟用 Row Level Security
ALTER TABLE vaccination_records ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略：允許所有已認證用戶查看疫苗記錄
CREATE POLICY "Allow authenticated users to view vaccination records"
  ON vaccination_records
  FOR SELECT
  TO authenticated
  USING (true);

-- 創建 RLS 策略：允許所有已認證用戶新增疫苗記錄
CREATE POLICY "Allow authenticated users to insert vaccination records"
  ON vaccination_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 創建 RLS 策略：允許所有已認證用戶更新疫苗記錄
CREATE POLICY "Allow authenticated users to update vaccination records"
  ON vaccination_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 創建 RLS 策略：允許所有已認證用戶刪除疫苗記錄
CREATE POLICY "Allow authenticated users to delete vaccination records"
  ON vaccination_records
  FOR DELETE
  TO authenticated
  USING (true);