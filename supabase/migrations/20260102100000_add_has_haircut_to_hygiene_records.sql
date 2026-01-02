-- 新增 has_haircut 欄位到 hygiene_records 表
ALTER TABLE hygiene_records 
ADD COLUMN IF NOT EXISTS has_haircut BOOLEAN DEFAULT FALSE;

-- 添加欄位註釋
COMMENT ON COLUMN hygiene_records.has_haircut IS '剪髮';
