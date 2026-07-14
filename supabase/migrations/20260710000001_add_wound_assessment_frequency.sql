/*
  # 傷口評估頻率設定（沿用任務管理頻率模型）
  - assessment_frequency_unit: daily | weekly（預設 daily）
  - assessment_frequency_value: 天數 1-7（daily 時使用）
  - assessment_specific_days_of_week: 指定星期幾 1-7（weekly 時使用，同任務模型 1=週一…7=週日）
*/

ALTER TABLE wounds
  ADD COLUMN IF NOT EXISTS assessment_frequency_unit text DEFAULT (chr(39)||chr(100)||chr(97)||chr(105)||chr(108)||chr(121)||chr(39)),
  ADD COLUMN IF NOT EXISTS assessment_frequency_value integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS assessment_specific_days_of_week integer[] DEFAULT NULL;
