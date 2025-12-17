/*
  # 新增藥物數量和服用日數欄位

  1. 新增欄位
    - `medication_quantity` - 藥物數量（如：30片、100ml）
    - `duration_days` - 服用日數（用於自動計算結束日期）

  2. 說明
    - medication_quantity 用於記錄藥物總量
    - duration_days 用於自動計算 end_date
    - 當 duration_days 有值時，系統會根據 start_date + duration_days 計算 end_date
*/

-- 新增藥物數量欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'medication_quantity'
  ) THEN
    ALTER TABLE new_medication_prescriptions 
    ADD COLUMN medication_quantity text;
  END IF;
END $$;

-- 新增服用日數欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'duration_days'
  ) THEN
    ALTER TABLE new_medication_prescriptions 
    ADD COLUMN duration_days integer;
  END IF;
END $$;

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_new_prescriptions_duration_days ON new_medication_prescriptions(duration_days);

-- 創建函數：根據服用日數自動計算結束日期
CREATE OR REPLACE FUNCTION calculate_end_date_from_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果有 duration_days 且有 start_date，自動計算 end_date
  IF NEW.duration_days IS NOT NULL AND NEW.duration_days > 0 AND NEW.start_date IS NOT NULL THEN
    NEW.end_date := NEW.start_date + (NEW.duration_days || ' days')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS trigger_calculate_end_date ON new_medication_prescriptions;
CREATE TRIGGER trigger_calculate_end_date
  BEFORE INSERT OR UPDATE OF duration_days, start_date ON new_medication_prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_end_date_from_duration();

-- 註釋
COMMENT ON COLUMN new_medication_prescriptions.medication_quantity IS '藥物總數量，如：30片、100ml';
COMMENT ON COLUMN new_medication_prescriptions.duration_days IS '服用日數，用於自動計算結束日期';
