-- 移除每位院友只能有一筆年度體檢記錄的唯一性約束
-- 改為允許多筆歷史記錄，UI 以折疊方式顯示
ALTER TABLE annual_health_checkups
  DROP CONSTRAINT IF EXISTS unique_patient_annual_checkup;

-- 索引已存在（idx_annual_health_checkups_patient_id），無需重建
