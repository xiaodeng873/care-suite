-- 晚晴計劃簡化：每份文件只保留一個醫生簽署日期，
-- 到期日由簽署日期 + 1 年推算（前端顯示，唔落 DB）。
-- 上一版嘅 jsonb 陣列欄位從未寫入過數據（表為空），直接替換。

ALTER TABLE patient_evening_care_plans
  ADD COLUMN IF NOT EXISTS acp_sign_date date,
  ADD COLUMN IF NOT EXISTS amd_sign_date date,
  ADD COLUMN IF NOT EXISTS dnacpr_sign_date date;

ALTER TABLE patient_evening_care_plans
  DROP COLUMN IF EXISTS acp_sign_dates,
  DROP COLUMN IF EXISTS amd_sign_dates,
  DROP COLUMN IF EXISTS dnacpr_sign_dates;
