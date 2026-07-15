/*
  約束物品評估：新增「約束物品使用紀錄」JSONB 欄位
  每次評估對應一筆使用記錄（開始日期、結束日期、原因、種類、處方醫生、觀察事項）
*/
ALTER TABLE patient_restraint_assessments
  ADD COLUMN IF NOT EXISTS usage_record JSONB;
