/*
  # 建立藥物資料庫表

  1. 新增資料表
    - `medication_drug_database`
      - `id` (uuid, 主鍵)
      - `drug_name` (text, 藥物名稱, 必填)
      - `drug_code` (text, 藥物編號, 唯一)
      - `drug_type` (text, 藥物類型)
      - `administration_route` (text, 使用途徑)
      - `unit` (text, 藥物單位)
      - `photo_url` (text, 藥物相片URL)
      - `notes` (text, 藥物備註)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 安全設定
    - 啟用 RLS
    - 新增已認證用戶的讀取和修改政策

  3. 索引
    - 藥物名稱索引（支援搜索）
    - 藥物編號索引
    - 使用途徑索引
*/

-- 建立藥物資料庫表
CREATE TABLE IF NOT EXISTS medication_drug_database (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name text NOT NULL,
  drug_code text UNIQUE,
  drug_type text,
  administration_route text,
  unit text,
  photo_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE medication_drug_database ENABLE ROW LEVEL SECURITY;

-- 建立政策
CREATE POLICY "允許已認證用戶讀取藥物資料庫"
  ON medication_drug_database
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增藥物資料庫"
  ON medication_drug_database
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新藥物資料庫"
  ON medication_drug_database
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除藥物資料庫"
  ON medication_drug_database
  FOR DELETE
  TO authenticated
  USING (true);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_medication_drug_database_drug_name 
  ON medication_drug_database USING btree (drug_name);

CREATE INDEX IF NOT EXISTS idx_medication_drug_database_drug_code 
  ON medication_drug_database USING btree (drug_code);

CREATE INDEX IF NOT EXISTS idx_medication_drug_database_administration_route 
  ON medication_drug_database USING btree (administration_route);

CREATE INDEX IF NOT EXISTS idx_medication_drug_database_drug_type 
  ON medication_drug_database USING btree (drug_type);

-- 建立更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_medication_drug_database_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
CREATE TRIGGER update_medication_drug_database_updated_at
  BEFORE UPDATE ON medication_drug_database
  FOR EACH ROW
  EXECUTE FUNCTION update_medication_drug_database_updated_at();

-- 插入一些範例藥物資料
INSERT INTO medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes) VALUES
('Paracetamol', 'PAR001', '止痛藥', '口服', '粒', '常用退燒止痛藥'),
('Aspirin', 'ASP001', '止痛藥', '口服', '粒', '阿司匹林，用於心血管保護'),
('Metformin', 'MET001', '糖尿病藥', '口服', '粒', '二甲雙胍，用於控制血糖'),
('Lisinopril', 'LIS001', '降血壓藥', '口服', '粒', 'ACE抑制劑'),
('Omeprazole', 'OME001', '胃藥', '口服', '粒', '質子泵抑制劑'),
('Simvastatin', 'SIM001', '降膽固醇藥', '口服', '粒', '他汀類藥物'),
('Warfarin', 'WAR001', '抗凝血藥', '口服', '粒', '華法林，需定期監測INR'),
('Furosemide', 'FUR001', '利尿劑', '口服', '粒', '呋塞米，強效利尿劑'),
('Amlodipine', 'AML001', '降血壓藥', '口服', '粒', '鈣通道阻滯劑'),
('Atorvastatin', 'ATO001', '降膽固醇藥', '口服', '粒', '阿托伐他汀')
ON CONFLICT (drug_code) DO NOTHING;