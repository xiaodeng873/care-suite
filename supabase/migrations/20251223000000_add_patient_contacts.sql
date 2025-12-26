/*
  # 添加院友聯絡人表

  1. 新資料表
    - `patient_contacts` (院友聯絡人) - 儲存院友的聯絡人資訊
  
  2. 功能
    - 支援動態增減聯絡人
    - 可標記第一聯絡人
    - 包含姓名、電話、電郵、地址、備註
  
  3. 安全設定
    - 啟用 RLS
    - 允許已驗證用戶操作
*/

-- 建立院友聯絡人表
CREATE TABLE IF NOT EXISTS patient_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  院友id INT NOT NULL REFERENCES 院友主表(院友id) ON DELETE CASCADE,
  聯絡人姓名 VARCHAR(100) NOT NULL,
  關係 VARCHAR(50),
  聯絡電話 VARCHAR(50),
  電郵 VARCHAR(100),
  地址 TEXT,
  備註 TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 確保每個院友只能有一個第一聯絡人
  CONSTRAINT unique_primary_contact_per_patient 
    EXCLUDE (院友id WITH =) WHERE (is_primary = true)
);

-- 建立索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_patient_contacts_patient_id ON patient_contacts(院友id);
CREATE INDEX IF NOT EXISTS idx_patient_contacts_is_primary ON patient_contacts(院友id, is_primary) WHERE is_primary = true;

-- 添加註釋
COMMENT ON TABLE patient_contacts IS '院友聯絡人資訊表';
COMMENT ON COLUMN patient_contacts.院友id IS '院友ID（外鍵）';
COMMENT ON COLUMN patient_contacts.聯絡人姓名 IS '聯絡人姓名';
COMMENT ON COLUMN patient_contacts.關係 IS '與院友的關係（如：子女、配偶、親友等）';
COMMENT ON COLUMN patient_contacts.聯絡電話 IS '聯絡電話';
COMMENT ON COLUMN patient_contacts.電郵 IS '電子郵件地址';
COMMENT ON COLUMN patient_contacts.地址 IS '聯絡地址';
COMMENT ON COLUMN patient_contacts.備註 IS '備註說明';
COMMENT ON COLUMN patient_contacts.is_primary IS '是否為第一聯絡人（只能有一個）';

-- 建立更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_patient_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
DROP TRIGGER IF EXISTS trigger_update_patient_contacts_updated_at ON patient_contacts;
CREATE TRIGGER trigger_update_patient_contacts_updated_at
  BEFORE UPDATE ON patient_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_contacts_updated_at();

-- 啟用 RLS
ALTER TABLE patient_contacts ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 政策：允許已驗證用戶查詢所有聯絡人
DROP POLICY IF EXISTS "Allow authenticated users to view patient contacts" ON patient_contacts;
CREATE POLICY "Allow authenticated users to view patient contacts"
  ON patient_contacts
  FOR SELECT
  TO authenticated
  USING (true);

-- 建立 RLS 政策：允許已驗證用戶新增聯絡人
DROP POLICY IF EXISTS "Allow authenticated users to insert patient contacts" ON patient_contacts;
CREATE POLICY "Allow authenticated users to insert patient contacts"
  ON patient_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 建立 RLS 政策：允許已驗證用戶更新聯絡人
DROP POLICY IF EXISTS "Allow authenticated users to update patient contacts" ON patient_contacts;
CREATE POLICY "Allow authenticated users to update patient contacts"
  ON patient_contacts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 建立 RLS 政策：允許已驗證用戶刪除聯絡人
DROP POLICY IF EXISTS "Allow authenticated users to delete patient contacts" ON patient_contacts;
CREATE POLICY "Allow authenticated users to delete patient contacts"
  ON patient_contacts
  FOR DELETE
  TO authenticated
  USING (true);
