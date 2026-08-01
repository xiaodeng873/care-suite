-- 在處方表中新增「上次服用日期」與「是否映射到備藥及給藥記錄」欄位
ALTER TABLE new_medication_prescriptions
  ADD COLUMN IF NOT EXISTS last_taken_date DATE,
  ADD COLUMN IF NOT EXISTS show_last_taken_in_record BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN new_medication_prescriptions.last_taken_date IS '最近完成給藥的日期';
COMMENT ON COLUMN new_medication_prescriptions.show_last_taken_in_record IS '是否在備藥及給藥記錄中顯示上次服用日期';
