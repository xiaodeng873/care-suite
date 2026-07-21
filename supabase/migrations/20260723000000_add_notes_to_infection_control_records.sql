-- 為感染控制記錄表新增備註欄位
ALTER TABLE infection_control_records ADD COLUMN IF NOT EXISTS notes text;
