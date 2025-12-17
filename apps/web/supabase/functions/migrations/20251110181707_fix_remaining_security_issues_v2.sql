/*
  # 修復剩餘安全問題 V2

  1. 重新創建必要的外鍵索引
    - wound_assessments.patient_id
    - 到診院友_看診原因.原因id
    - 看診院友細項.院友id
  
  2. 移除確實未使用的索引
    - idx_hospital_episodes_patient_id_fkey
    - idx_ocr_recognition_logs_user_id_fkey
    - idx_patient_admission_records_patient_id_fkey
  
  3. 修復函數重載問題
    - 為第二個 check_medication_workflow_duplicates 函數添加 search_path
*/

-- ==========================================
-- 1. 重新創建外鍵索引
-- ==========================================

-- wound_assessments.patient_id
CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient_id 
ON public.wound_assessments(patient_id);

-- 到診院友_看診原因.原因id
CREATE INDEX IF NOT EXISTS idx_到診院友_看診原因_原因id 
ON public.到診院友_看診原因(原因id);

-- 看診院友細項.院友id
CREATE INDEX IF NOT EXISTS idx_看診院友細項_院友id 
ON public.看診院友細項(院友id);

-- ==========================================
-- 2. 移除未使用的索引
-- ==========================================

-- 這些索引是剛創建的但確實未被使用（可能是因為查詢模式不同）
DROP INDEX IF EXISTS public.idx_hospital_episodes_patient_id_fkey;
DROP INDEX IF EXISTS public.idx_ocr_recognition_logs_user_id_fkey;
DROP INDEX IF EXISTS public.idx_patient_admission_records_patient_id_fkey;

-- ==========================================
-- 3. 修復函數重載的 search_path 問題
-- ==========================================

-- 刪除有問題的重載函數
DROP FUNCTION IF EXISTS public.check_medication_workflow_duplicates(uuid, date, time);

-- 重新創建帶有 search_path 的版本
CREATE OR REPLACE FUNCTION public.check_medication_workflow_duplicates(
  p_prescription_id uuid, 
  p_scheduled_date date, 
  p_scheduled_time time
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  record_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO record_count
  FROM medication_workflow_records
  WHERE prescription_id = p_prescription_id
  AND scheduled_date = p_scheduled_date
  AND scheduled_time = p_scheduled_time;
  
  RETURN record_count > 0;
END;
$$;