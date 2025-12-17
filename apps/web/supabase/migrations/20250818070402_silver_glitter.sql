/*
  # 添加傷口詳細資料缺失欄位

  1. 新增欄位
    - `wound_status` (text) - 傷口狀態：未處理、治療中、已痊癒
    - `responsible_unit` (text) - 負責單位：本院、社康

  2. 設定預設值
    - `wound_status` 預設為 '未處理'
    - `responsible_unit` 預設為 '本院'

  3. 添加索引
    - 為新欄位添加索引以提升查詢效能
*/

-- 添加傷口狀態欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_details' AND column_name = 'wound_status'
  ) THEN
    ALTER TABLE wound_details ADD COLUMN wound_status text DEFAULT '未處理';
  END IF;
END $$;

-- 添加負責單位欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_details' AND column_name = 'responsible_unit'
  ) THEN
    ALTER TABLE wound_details ADD COLUMN responsible_unit text DEFAULT '本院';
  END IF;
END $$;

-- 為新欄位添加索引
CREATE INDEX IF NOT EXISTS idx_wound_details_wound_status ON wound_details(wound_status);
CREATE INDEX IF NOT EXISTS idx_wound_details_responsible_unit ON wound_details(responsible_unit);