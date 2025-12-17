/*
  # 添加約束物品欄位到約束觀察記錄表

  1. 修改表結構
    - 在 `restraint_observation_records` 表中添加 `used_restraints` 欄位
    - 類型為 JSONB，用於存儲使用的約束物品
    - 預設值為空 JSON 物件

  2. 說明
    - 此欄位用於記錄每次觀察時實際使用的約束物品
    - 格式為 JSON 物件，例如: {"bed_rail": true, "wheelchair_belt": true}
*/

-- 添加 used_restraints 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restraint_observation_records' 
    AND column_name = 'used_restraints'
  ) THEN
    ALTER TABLE restraint_observation_records 
    ADD COLUMN used_restraints jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;