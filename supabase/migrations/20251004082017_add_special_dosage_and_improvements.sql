/*
  # 新增特殊用法、皮膚貼劑和中午時段支援

  1. 修改內容
    - 新增 `special_dosage_instruction` 欄位到處方表，用於特殊用法（如：搽患處、貼在皮膚上、適量）
    - 新增 `medication_source` 欄位到處方表，用於記錄藥物來源（如已存在則跳過）
    - 新增 `daily_frequency` 欄位到處方表，用於記錄每日服用次數（如已存在則跳過）
    - 新增 `meal_timing` 欄位到處方表，用於記錄餐前/餐後（如已存在則跳過）
    - 為服用時段表新增"中午"選項

  2. 說明
    - special_dosage_instruction 與 dosage_amount/dosage_unit 互斥使用
    - 當使用 special_dosage_instruction 時，dosage_amount 和 dosage_unit 應為 null
    - 劑型新增"皮膚貼劑"選項
    - 藥水、注射劑、外用藥膏、滴劑、皮膚貼劑的備藥方式預設為"即時備藥"
*/

-- 新增特殊用法欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'special_dosage_instruction'
  ) THEN
    ALTER TABLE new_medication_prescriptions 
    ADD COLUMN special_dosage_instruction text;
  END IF;
END $$;

-- 新增藥物來源欄位（如不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'medication_source'
  ) THEN
    ALTER TABLE new_medication_prescriptions 
    ADD COLUMN medication_source text;
  END IF;
END $$;

-- 新增每日服用次數欄位（如不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'daily_frequency'
  ) THEN
    ALTER TABLE new_medication_prescriptions 
    ADD COLUMN daily_frequency integer DEFAULT 1;
  END IF;
END $$;

-- 新增餐前餐後欄位（如不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'meal_timing'
  ) THEN
    ALTER TABLE new_medication_prescriptions 
    ADD COLUMN meal_timing text;
  END IF;
END $$;

-- 插入"中午"時段定義（如果不存在）
INSERT INTO prescription_time_slot_definitions (slot_name, start_time, end_time, description)
VALUES ('中午', '12:00:00', '13:00:00', '中午服藥時段')
ON CONFLICT (slot_name) DO NOTHING;

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_new_prescriptions_special_dosage ON new_medication_prescriptions(special_dosage_instruction);
CREATE INDEX IF NOT EXISTS idx_new_prescriptions_medication_source ON new_medication_prescriptions(medication_source);
CREATE INDEX IF NOT EXISTS idx_new_prescriptions_daily_frequency ON new_medication_prescriptions(daily_frequency);

-- 創建函數：根據劑型自動設定備藥方式
CREATE OR REPLACE FUNCTION set_preparation_method_by_dosage_form()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果劑型為藥水、注射劑、外用藥膏、滴劑、皮膚貼劑，則備藥方式預設為即時備藥
  IF NEW.dosage_form IN ('藥水', '注射劑', '外用藥膏', '滴劑', '皮膚貼劑') THEN
    IF NEW.preparation_method IS NULL OR NEW.preparation_method = 'advanced' THEN
      NEW.preparation_method := 'immediate';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS trigger_set_preparation_method ON new_medication_prescriptions;
CREATE TRIGGER trigger_set_preparation_method
  BEFORE INSERT OR UPDATE OF dosage_form ON new_medication_prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_preparation_method_by_dosage_form();

-- 註釋
COMMENT ON COLUMN new_medication_prescriptions.special_dosage_instruction IS '特殊用法指示，如：搽患處、貼在皮膚上、適量。與dosage_amount/dosage_unit互斥使用';
COMMENT ON COLUMN new_medication_prescriptions.medication_source IS '藥物來源，如：醫院、診所、藥房名稱';
COMMENT ON COLUMN new_medication_prescriptions.daily_frequency IS '每日服用次數';
COMMENT ON COLUMN new_medication_prescriptions.meal_timing IS '餐前或餐後';
