-- 添加缺失的 bowel_medication 欄位
ALTER TABLE hygiene_records 
ADD COLUMN IF NOT EXISTS bowel_medication text;

-- 添加註釋
COMMENT ON COLUMN hygiene_records.bowel_medication IS '大便藥：通便藥物記錄';
