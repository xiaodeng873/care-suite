/*
  # 創建診斷記錄資料表

  ## 新增資料表
  - `diagnosis_records` - 診斷記錄表
    - `id` (uuid, primary key) - 記錄ID
    - `patient_id` (integer, foreign key) - 院友ID，關聯到院友主表
    - `diagnosis_date` (date) - 診斷日期
    - `diagnosis_item` (text) - 診斷項目/病名
    - `diagnosis_unit` (text) - 診斷單位/醫院名稱
    - `remarks` (text, optional) - 備註
    - `created_at` (timestamptz) - 記錄創建時間
    - `updated_at` (timestamptz) - 記錄更新時間
    - `created_by` (uuid) - 創建者ID

  ## 安全性設置
  - 啟用 RLS (Row Level Security)
  - 為authenticated用戶添加完整的CRUD權限策略
  - 添加索引以優化查詢性能

  ## 業務邏輯
  - 支援在住、待入住、已退住院友的診斷記錄管理
  - 記錄院友的醫學診斷歷史
  - 可追蹤診斷的醫療單位來源
*/

-- 創建診斷記錄表
CREATE TABLE IF NOT EXISTS diagnosis_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  diagnosis_date date NOT NULL,
  diagnosis_item text NOT NULL,
  diagnosis_unit text NOT NULL,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 創建索引以優化查詢性能
CREATE INDEX IF NOT EXISTS idx_diagnosis_records_patient_id ON diagnosis_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_records_diagnosis_date ON diagnosis_records(diagnosis_date);
CREATE INDEX IF NOT EXISTS idx_diagnosis_records_created_at ON diagnosis_records(created_at);

-- 創建更新時間觸發器
CREATE OR REPLACE FUNCTION update_diagnosis_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_diagnosis_records_updated_at
  BEFORE UPDATE ON diagnosis_records
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnosis_records_updated_at();

-- 啟用 Row Level Security
ALTER TABLE diagnosis_records ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略：允許所有已認證用戶查看診斷記錄
CREATE POLICY "Allow authenticated users to view diagnosis records"
  ON diagnosis_records
  FOR SELECT
  TO authenticated
  USING (true);

-- 創建 RLS 策略：允許所有已認證用戶新增診斷記錄
CREATE POLICY "Allow authenticated users to insert diagnosis records"
  ON diagnosis_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 創建 RLS 策略：允許所有已認證用戶更新診斷記錄
CREATE POLICY "Allow authenticated users to update diagnosis records"
  ON diagnosis_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 創建 RLS 策略：允許所有已認證用戶刪除診斷記錄
CREATE POLICY "Allow authenticated users to delete diagnosis records"
  ON diagnosis_records
  FOR DELETE
  TO authenticated
  USING (true);