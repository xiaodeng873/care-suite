-- 新增 medication_workflow_settings 的 patient_id 和 batch_cutoff_time 欄位
-- 用於存儲每個院友的執核藥截止時間設定

-- 添加欄位到 medication_workflow_settings
ALTER TABLE medication_workflow_settings 
  ADD COLUMN IF NOT EXISTS patient_id integer,
  ADD COLUMN IF NOT EXISTS batch_cutoff_time text DEFAULT '18:00';

-- 添加索引以支援快速查詢
CREATE INDEX IF NOT EXISTS idx_medication_workflow_settings_patient_id 
  ON medication_workflow_settings(patient_id);

CREATE INDEX IF NOT EXISTS idx_medication_workflow_settings_user_patient 
  ON medication_workflow_settings(user_id, patient_id);
