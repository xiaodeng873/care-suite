-- =============================================
-- 修復醫院外展記錄觸發器錯誤
-- =============================================
-- 問題1：calculate_end_date_trigger 觸發器錯誤地綁定在 hospital_outreach_records 表上
-- 該觸發器調用的函數 calculate_end_date_from_duration() 引用了 duration_days 和 medication_start_date 欄位
-- 但這些欄位不存在於 hospital_outreach_records 表中，導致插入/更新記錄時出錯
-- 
-- 問題2：archive_old_outreach_record 函數嘗試插入 hospital_name 等欄位到 hospital_outreach_record_history
-- 但這些欄位在歷史表中不存在
-- 
-- 解決方案：移除錯誤的觸發器並修復歸檔函數

-- 移除錯誤的觸發器
DROP TRIGGER IF EXISTS calculate_end_date_trigger ON hospital_outreach_records;

-- 移除錯誤的歸檔觸發器
DROP TRIGGER IF EXISTS archive_outreach_record_trigger ON hospital_outreach_records;

-- 重新創建正確的歸檔函數
DROP FUNCTION IF EXISTS public.archive_old_outreach_record() CASCADE;

CREATE OR REPLACE FUNCTION public.archive_old_outreach_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 如果是更新操作且藥袋日期有變更，將舊記錄歸檔
  IF TG_OP = 'UPDATE' AND OLD.medication_bag_date IS DISTINCT FROM NEW.medication_bag_date THEN
    INSERT INTO hospital_outreach_record_history (
      patient_id,
      original_record_id,
      medication_bag_date,
      prescription_weeks,
      medication_end_date,
      outreach_appointment_date,
      medication_pickup_arrangement,
      outreach_medication_source,
      remarks,
      archived_at,
      archived_by
    ) VALUES (
      OLD.patient_id,
      OLD.id,
      OLD.medication_bag_date,
      OLD.prescription_weeks,
      OLD.medication_end_date,
      OLD.outreach_appointment_date,
      OLD.medication_pickup_arrangement,
      OLD.outreach_medication_source,
      OLD.remarks,
      now(),
      '系統自動歸檔'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 重新創建歸檔觸發器
CREATE TRIGGER archive_outreach_record_trigger
  BEFORE UPDATE ON hospital_outreach_records
  FOR EACH ROW
  EXECUTE FUNCTION archive_old_outreach_record();
