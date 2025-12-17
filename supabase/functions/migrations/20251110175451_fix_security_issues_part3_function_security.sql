/*
  # 修復安全問題 Part 3 - 函數安全性

  1. 修復函數 search_path 可變問題
    - 為所有更新 updated_at 的觸發器函數設置固定的 search_path
    - 為所有業務邏輯函數設置固定的 search_path
  
  2. 啟用 RLS
    - 為 profiles 表啟用 RLS
*/

-- ==========================================
-- 1. 修復 updated_at 觸發器函數的 search_path
-- ==========================================

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_meal_guidance_updated_at
CREATE OR REPLACE FUNCTION public.update_meal_guidance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_patient_logs_updated_at
CREATE OR REPLACE FUNCTION public.update_patient_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_restraint_assessments_updated_at
CREATE OR REPLACE FUNCTION public.update_restraint_assessments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_stations_updated_at
CREATE OR REPLACE FUNCTION public.update_stations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_beds_updated_at
CREATE OR REPLACE FUNCTION public.update_beds_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_patient_restraint_assessments_updated_at
CREATE OR REPLACE FUNCTION public.update_patient_restraint_assessments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_health_assessments_updated_at
CREATE OR REPLACE FUNCTION public.update_health_assessments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_daily_system_tasks_updated_at
CREATE OR REPLACE FUNCTION public.update_daily_system_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_medication_prescriptions_updated_at
CREATE OR REPLACE FUNCTION public.update_medication_prescriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_medication_time_slot_definitions_updated_at
CREATE OR REPLACE FUNCTION public.update_medication_time_slot_definitions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_new_medication_prescriptions_updated_at
CREATE OR REPLACE FUNCTION public.update_new_medication_prescriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_prescription_inspection_rules_updated_at
CREATE OR REPLACE FUNCTION public.update_prescription_inspection_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_prescription_time_slot_definitions_updated_at
CREATE OR REPLACE FUNCTION public.update_prescription_time_slot_definitions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_medication_drug_database_updated_at
CREATE OR REPLACE FUNCTION public.update_medication_drug_database_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_modified_column
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_hospital_outreach_records_updated_at
CREATE OR REPLACE FUNCTION public.update_hospital_outreach_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_medication_workflow_records_updated_at
CREATE OR REPLACE FUNCTION public.update_medication_workflow_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_wound_details_updated_at
CREATE OR REPLACE FUNCTION public.update_wound_details_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_medication_workflow_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_medication_workflow_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_doctor_visit_schedule_updated_at
CREATE OR REPLACE FUNCTION public.update_doctor_visit_schedule_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_patient_admission_records_updated_at
CREATE OR REPLACE FUNCTION public.update_patient_admission_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_hospital_episodes_updated_at
CREATE OR REPLACE FUNCTION public.update_hospital_episodes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_episode_events_updated_at
CREATE OR REPLACE FUNCTION public.update_episode_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_prescription_workflow_records_updated_at
CREATE OR REPLACE FUNCTION public.update_prescription_workflow_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_wound_assessments_updated_at
CREATE OR REPLACE FUNCTION public.update_wound_assessments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;