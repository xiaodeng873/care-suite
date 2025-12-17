/*
  # 更新醫院外展記錄表結構

  1. 新增欄位
    - `medication_sources` (jsonb) - 儲存多個藥物來源的陣列
  
  2. 索引
    - 為 `medication_sources` JSONB 欄位創建 GIN 索引
  
  3. 向後兼容性
    - 保留原有的單一藥物來源欄位
    - 新功能將使用 JSONB 欄位儲存多個藥物來源
*/

-- 新增 medication_sources JSONB 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospital_outreach_records' AND column_name = 'medication_sources'
  ) THEN
    ALTER TABLE hospital_outreach_records 
    ADD COLUMN medication_sources jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 為 medication_sources 欄位創建 GIN 索引
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'hospital_outreach_records' 
    AND indexname = 'idx_hospital_outreach_records_medication_sources'
  ) THEN
    CREATE INDEX idx_hospital_outreach_records_medication_sources 
    ON hospital_outreach_records USING gin (medication_sources);
  END IF;
END $$;