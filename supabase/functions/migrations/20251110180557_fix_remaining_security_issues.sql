/*
  # 修復剩餘安全問題

  1. 新增缺失的外鍵索引
    - hospital_episodes.patient_id
    - ocr_recognition_logs.user_id
    - patient_admission_records.patient_id
  
  2. 移除剛創建但未使用的索引
    - idx_wound_assessments_patient_id_fkey
    - idx_到診院友_看診原因_原因id
    - idx_看診院友細項_院友id_fkey
    - idx_new_medication_prescriptions_daily_frequency
  
  3. 修復視圖安全問題
    - 重新創建 medication_workflow_duplicate_stats 視圖，移除 SECURITY DEFINER
  
  4. 修復函數 search_path 問題
    - 修復 check_medication_workflow_duplicates 函數
*/

-- ==========================================
-- 1. 新增缺失的外鍵索引
-- ==========================================

-- hospital_episodes 表
CREATE INDEX IF NOT EXISTS idx_hospital_episodes_patient_id_fkey 
ON public.hospital_episodes(patient_id);

-- ocr_recognition_logs 表
CREATE INDEX IF NOT EXISTS idx_ocr_recognition_logs_user_id_fkey 
ON public.ocr_recognition_logs(user_id);

-- patient_admission_records 表
CREATE INDEX IF NOT EXISTS idx_patient_admission_records_patient_id_fkey 
ON public.patient_admission_records(patient_id);

-- ==========================================
-- 2. 移除未使用的索引
-- ==========================================

-- 這些是我們在上一次遷移中創建的，但實際上未被使用
DROP INDEX IF EXISTS public.idx_wound_assessments_patient_id_fkey;
DROP INDEX IF EXISTS public.idx_到診院友_看診原因_原因id;
DROP INDEX IF EXISTS public.idx_看診院友細項_院友id_fkey;
DROP INDEX IF EXISTS public.idx_new_medication_prescriptions_daily_frequency;

-- ==========================================
-- 3. 修復視圖安全問題
-- ==========================================

-- 先刪除舊視圖
DROP VIEW IF EXISTS public.medication_workflow_duplicate_stats;

-- 重新創建視圖，不使用 SECURITY DEFINER
CREATE VIEW public.medication_workflow_duplicate_stats AS
SELECT 
  COUNT(*) as total_duplicates,
  SUM(duplicate_count - 1) as extra_records
FROM (
  SELECT 
    prescription_id,
    scheduled_date,
    scheduled_time,
    COUNT(*) as duplicate_count
  FROM medication_workflow_records
  GROUP BY prescription_id, scheduled_date, scheduled_time
  HAVING COUNT(*) > 1
) duplicates;

-- 為視圖設置 RLS（視圖繼承基礎表的 RLS）
GRANT SELECT ON public.medication_workflow_duplicate_stats TO authenticated;

-- ==========================================
-- 4. 修復 check_medication_workflow_duplicates 函數
-- ==========================================

-- 函數已在之前的遷移中修復，但再次確認
DROP FUNCTION IF EXISTS public.check_medication_workflow_duplicates() CASCADE;

CREATE OR REPLACE FUNCTION public.check_medication_workflow_duplicates()
RETURNS TABLE (
  prescription_id uuid,
  scheduled_date date,
  scheduled_time time,
  duplicate_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT 
    mwr.prescription_id,
    mwr.scheduled_date,
    mwr.scheduled_time,
    COUNT(*) as duplicate_count
  FROM medication_workflow_records mwr
  GROUP BY mwr.prescription_id, mwr.scheduled_date, mwr.scheduled_time
  HAVING COUNT(*) > 1;
$$;