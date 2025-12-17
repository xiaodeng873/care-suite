/*
  # 更新醫院外展記錄表結構

  1. 表格變更
    - 新增 `medication_sources` JSONB 欄位來儲存多個藥物來源
    - 保留原有欄位以維持向後兼容性
    - 新增索引以提升查詢效能

  2. 資料結構
    - `medication_sources` 將儲存藥物來源陣列
    - 每個藥物來源包含：medication_bag_date, prescription_weeks, medication_end_date, outreach_medication_source
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

-- 創建索引以提升 JSONB 查詢效能
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_medication_sources 
ON hospital_outreach_records USING gin (medication_sources);