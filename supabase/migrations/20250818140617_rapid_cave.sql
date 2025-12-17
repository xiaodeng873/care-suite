/*
  # 添加傷口相片功能

  1. 修改表格
    - 在 `wound_details` 表格中添加 `wound_photos` 欄位用於儲存相片資料
    
  2. 安全性
    - 維持現有的 RLS 策略
*/

-- 添加傷口相片欄位到 wound_details 表格
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_details' AND column_name = 'wound_photos'
  ) THEN
    ALTER TABLE wound_details ADD COLUMN wound_photos jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 添加索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_wound_details_wound_photos 
ON wound_details USING gin (wound_photos);

-- 添加註釋
COMMENT ON COLUMN wound_details.wound_photos IS '傷口相片資料，儲存為 base64 格式的 JSON 陣列';