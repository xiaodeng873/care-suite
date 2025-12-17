/*
  # 修復安全問題 Part 4 - 業務邏輯函數安全性（最終版）

  1. 修復業務邏輯函數的 search_path
    - check_medication_workflow_duplicates
    - sync_bed_occupied_status
    - fix_bed_occupied_status
    - set_preparation_method_by_dosage_form
    - archive_old_outreach_record
    - calculate_end_date_from_duration
*/

-- check_medication_workflow_duplicates
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
SET search_path = public, pg_temp
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

-- sync_bed_occupied_status
DROP FUNCTION IF EXISTS public.sync_bed_occupied_status() CASCADE;

CREATE OR REPLACE FUNCTION public.sync_bed_occupied_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE beds
  SET is_occupied = EXISTS (
    SELECT 1 FROM 院友主表
    WHERE 院友主表.床號 = beds.bed_number
    AND 院友主表.在住狀態 = '在院'
  );
  RETURN NEW;
END;
$$;

-- 重新創建觸發器
DROP TRIGGER IF EXISTS trigger_sync_bed_occupied_status ON 院友主表;
CREATE TRIGGER trigger_sync_bed_occupied_status
AFTER INSERT OR UPDATE OF 床號, 在住狀態 ON 院友主表
FOR EACH ROW
EXECUTE FUNCTION sync_bed_occupied_status();

-- fix_bed_occupied_status
DROP FUNCTION IF EXISTS public.fix_bed_occupied_status() CASCADE;

CREATE OR REPLACE FUNCTION public.fix_bed_occupied_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE beds
  SET is_occupied = EXISTS (
    SELECT 1 FROM 院友主表
    WHERE 院友主表.床號 = beds.bed_number
    AND 院友主表.在住狀態 = '在院'
  );
END;
$$;

-- set_preparation_method_by_dosage_form
DROP FUNCTION IF EXISTS public.set_preparation_method_by_dosage_form() CASCADE;

CREATE OR REPLACE FUNCTION public.set_preparation_method_by_dosage_form()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.劑型 IN ('內服液', '外用液', '眼藥水', '鼻噴劑', '滴劑') THEN
    NEW.preparation_method = 'original';
  ELSIF NEW.劑型 IN ('錠劑', '膠囊', '軟膠囊', '糖衣錠', '發泡錠') THEN
    NEW.preparation_method = 'blister';
  END IF;
  RETURN NEW;
END;
$$;

-- 重新創建觸發器
DROP TRIGGER IF EXISTS set_preparation_method_trigger ON new_medication_prescriptions;
CREATE TRIGGER set_preparation_method_trigger
BEFORE INSERT OR UPDATE ON new_medication_prescriptions
FOR EACH ROW
EXECUTE FUNCTION set_preparation_method_by_dosage_form();

-- archive_old_outreach_record
DROP FUNCTION IF EXISTS public.archive_old_outreach_record() CASCADE;

CREATE OR REPLACE FUNCTION public.archive_old_outreach_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO hospital_outreach_record_history (
    id,
    patient_id,
    outreach_appointment_date,
    hospital_name,
    department,
    doctor_name,
    diagnosis,
    medication_start_date,
    medication_end_date,
    medication_sources,
    pickup_arrangement,
    medication_bag_date,
    notes,
    created_at,
    updated_at,
    archived_at
  ) VALUES (
    OLD.id,
    OLD.patient_id,
    OLD.outreach_appointment_date,
    OLD.hospital_name,
    OLD.department,
    OLD.doctor_name,
    OLD.diagnosis,
    OLD.medication_start_date,
    OLD.medication_end_date,
    OLD.medication_sources,
    OLD.pickup_arrangement,
    OLD.medication_bag_date,
    OLD.notes,
    OLD.created_at,
    OLD.updated_at,
    NOW()
  );
  RETURN NEW;
END;
$$;

-- 重新創建觸發器
DROP TRIGGER IF EXISTS archive_outreach_record_trigger ON hospital_outreach_records;
CREATE TRIGGER archive_outreach_record_trigger
BEFORE UPDATE ON hospital_outreach_records
FOR EACH ROW
EXECUTE FUNCTION archive_old_outreach_record();

-- calculate_end_date_from_duration
DROP FUNCTION IF EXISTS public.calculate_end_date_from_duration() CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_end_date_from_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.duration_days IS NOT NULL AND NEW.duration_days > 0 AND NEW.medication_start_date IS NOT NULL THEN
    NEW.medication_end_date = NEW.medication_start_date + (NEW.duration_days - 1);
  END IF;
  RETURN NEW;
END;
$$;

-- 重新創建觸發器
DROP TRIGGER IF EXISTS calculate_end_date_trigger ON hospital_outreach_records;
CREATE TRIGGER calculate_end_date_trigger
BEFORE INSERT OR UPDATE ON hospital_outreach_records
FOR EACH ROW
EXECUTE FUNCTION calculate_end_date_from_duration();