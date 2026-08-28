-- 藥物資料庫新增預設劑型欄位，供新增處方時自動帶入
ALTER TABLE public.medication_drug_database
ADD COLUMN IF NOT EXISTS dosage_form text;
