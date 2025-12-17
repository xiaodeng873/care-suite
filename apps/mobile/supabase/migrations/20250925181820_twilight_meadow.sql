/*
  # 更新醫院外展記錄結構

  1. 新增欄位
    - `medication_sources` (jsonb) - 儲存多個藥物來源的陣列
      - 每個藥物來源包含：藥袋日期、處方週數、藥完日期、藥物出處

  2. 索引
    - 為 `medication_sources` JSONB 欄位創建 GIN 索引以提升查詢效能

  3. 向後兼容性
    - 保留原有的單一藥物來源欄位
    - 新功能將使用 JSONB 欄位儲存多個藥物來源
*/

-- 新增 medication_sources JSONB 欄位到醫院外展記錄表
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

-- 為 medication_sources JSONB 欄位創建 GIN 索引
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_medication_sources 
ON hospital_outreach_records USING gin (medication_sources);

-- 新增註解說明新欄位的用途
COMMENT ON COLUMN hospital_outreach_records.medication_sources IS '儲存多個藥物來源的陣列，每個來源包含藥袋日期、處方週數、藥完日期和藥物出處';