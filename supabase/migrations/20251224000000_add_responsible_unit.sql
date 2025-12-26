/*
  # 添加負責換症單位欄位

  為 wounds 表添加 responsible_unit 和 responsible_unit_other 欄位
*/

-- 添加負責換症單位欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wounds' AND column_name = 'responsible_unit'
  ) THEN
    ALTER TABLE wounds ADD COLUMN responsible_unit text CHECK (responsible_unit IN ('community_health', 'cgat', 'facility_staff', 'other')) DEFAULT 'facility_staff';
  END IF;
END $$;

-- 添加其他單位說明欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wounds' AND column_name = 'responsible_unit_other'
  ) THEN
    ALTER TABLE wounds ADD COLUMN responsible_unit_other text;
  END IF;
END $$;

-- 為現有記錄設定默認值
UPDATE wounds 
SET responsible_unit = 'facility_staff' 
WHERE responsible_unit IS NULL;
