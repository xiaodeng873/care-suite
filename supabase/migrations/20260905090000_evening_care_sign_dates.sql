-- 晚晴計劃：三份文件（ACP / AMD / DNACPR）各自由單一日期改為
-- 可動態增減嘅醫生簽署日期列表（jsonb 字串陣列，格式 "YYYY-MM-DD"）。

ALTER TABLE patient_evening_care_plans
  ADD COLUMN IF NOT EXISTS acp_sign_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS amd_sign_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dnacpr_sign_dates jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 遷移現有單日期為該文件嘅第一筆簽署日期
UPDATE patient_evening_care_plans
  SET acp_sign_dates = jsonb_build_array(acp_date::text)
  WHERE acp_date IS NOT NULL AND jsonb_array_length(acp_sign_dates) = 0;
UPDATE patient_evening_care_plans
  SET amd_sign_dates = jsonb_build_array(amd_date::text)
  WHERE amd_date IS NOT NULL AND jsonb_array_length(amd_sign_dates) = 0;
UPDATE patient_evening_care_plans
  SET dnacpr_sign_dates = jsonb_build_array(dnacpr_date::text)
  WHERE dnacpr_date IS NOT NULL AND jsonb_array_length(dnacpr_sign_dates) = 0;

-- 舊欄位由新欄位取代，不再使用
ALTER TABLE patient_evening_care_plans
  DROP COLUMN IF EXISTS acp_date,
  DROP COLUMN IF EXISTS amd_date,
  DROP COLUMN IF EXISTS dnacpr_date;
