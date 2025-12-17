/*
  # 修復安全問題 Part 1 - 索引優化

  1. 新增索引
    - 為所有未索引的外鍵添加索引
    - profiles.user_id
    - wound_assessments.patient_id
    - 到診院友_看診原因.原因id
    - 看診院友細項.排程id
    - 看診院友細項.院友id
  
  2. 移除未使用的索引
    - 移除所有標記為未使用的索引以減少維護開銷
  
  3. 移除重複索引
    - 移除重複的索引定義
*/

-- ==========================================
-- 1. 為未索引的外鍵添加索引
-- ==========================================

-- profiles 表
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- wound_assessments 表
CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient_id_fkey ON public.wound_assessments(patient_id);

-- 到診院友_看診原因 表
CREATE INDEX IF NOT EXISTS idx_到診院友_看診原因_原因id ON public.到診院友_看診原因(原因id);

-- 看診院友細項 表
CREATE INDEX IF NOT EXISTS idx_看診院友細項_排程id ON public.看診院友細項(排程id);
CREATE INDEX IF NOT EXISTS idx_看診院友細項_院友id_fkey ON public.看診院友細項(院友id);

-- ==========================================
-- 2. 移除重複索引
-- ==========================================

-- 移除重複的 daily_frequency 索引（保留 idx_new_medication_prescriptions_daily_frequency）
DROP INDEX IF EXISTS public.idx_new_prescriptions_daily_frequency;

-- 移除重複的院友id索引（保留 idx_健康記錄_院友id）
DROP INDEX IF EXISTS public.idx_健康記錄主表_院友id;

-- ==========================================
-- 3. 移除未使用的索引
-- ==========================================

-- 院友主表未使用的索引
DROP INDEX IF EXISTS public.idx_院友主表_護理等級;
DROP INDEX IF EXISTS public.idx_院友主表_入住類型;
DROP INDEX IF EXISTS public.idx_院友主表_入住日期;
DROP INDEX IF EXISTS public.idx_院友主表_退住日期;
DROP INDEX IF EXISTS public.idx_院友主表_社會福利;
DROP INDEX IF EXISTS public.idx_院友主表_藥物敏感;
DROP INDEX IF EXISTS public.idx_院友主表_不良藥物反應;

-- new_medication_prescriptions 未使用的索引
DROP INDEX IF EXISTS public.idx_new_prescriptions_special_dosage;
DROP INDEX IF EXISTS public.idx_new_prescriptions_medication_source;
DROP INDEX IF EXISTS public.idx_new_prescriptions_created_by;
DROP INDEX IF EXISTS public.idx_new_prescriptions_last_modified_by;
DROP INDEX IF EXISTS public.idx_new_medication_prescriptions_medication_name;
DROP INDEX IF EXISTS public.idx_new_medication_prescriptions_time_slots;
DROP INDEX IF EXISTS public.idx_new_medication_prescriptions_inspection_rules;
DROP INDEX IF EXISTS public.idx_new_medication_prescriptions_dosage_unit;
DROP INDEX IF EXISTS public.idx_new_prescriptions_duration_days;

-- meal_guidance 未使用的索引
DROP INDEX IF EXISTS public.idx_meal_guidance_patient_id;
DROP INDEX IF EXISTS public.idx_meal_guidance_meal_combination;
DROP INDEX IF EXISTS public.idx_meal_guidance_special_diets;
DROP INDEX IF EXISTS public.idx_meal_guidance_guidance_date;
DROP INDEX IF EXISTS public.idx_meal_guidance_egg_quantity;
DROP INDEX IF EXISTS public.idx_meal_guidance_remarks;

-- health_assessments 未使用的索引
DROP INDEX IF EXISTS public.idx_health_assessments_next_due_date;
DROP INDEX IF EXISTS public.idx_health_assessments_created_at;

-- prescription_inspection_rules 未使用的索引
DROP INDEX IF EXISTS public.idx_prescription_inspection_rules_vital_sign_type;

-- patient_admission_records 未使用的索引
DROP INDEX IF EXISTS public.idx_patient_admission_records_discharge_type;
DROP INDEX IF EXISTS public.idx_patient_admission_records_date_of_death;
DROP INDEX IF EXISTS public.idx_patient_admission_records_transfer_paths;
DROP INDEX IF EXISTS public.idx_patient_admission_records_hospital_name;
DROP INDEX IF EXISTS public.idx_patient_admission_records_patient_id;
DROP INDEX IF EXISTS public.idx_patient_admission_records_event_type;
DROP INDEX IF EXISTS public.idx_patient_admission_records_created_at;

-- wound_details 未使用的索引
DROP INDEX IF EXISTS public.idx_wound_details_wound_status;
DROP INDEX IF EXISTS public.idx_wound_details_responsible_unit;
DROP INDEX IF EXISTS public.idx_wound_details_wound_photos;

-- templates_metadata 未使用的索引
DROP INDEX IF EXISTS public.idx_templates_metadata_type;
DROP INDEX IF EXISTS public.idx_templates_metadata_extracted_format;

-- hospital_episodes 未使用的索引
DROP INDEX IF EXISTS public.idx_hospital_episodes_patient_id;
DROP INDEX IF EXISTS public.idx_hospital_episodes_status;
DROP INDEX IF EXISTS public.idx_hospital_episodes_end_date;

-- episode_events 未使用的索引
DROP INDEX IF EXISTS public.idx_episode_events_event_type;
DROP INDEX IF EXISTS public.idx_episode_events_event_date;
DROP INDEX IF EXISTS public.idx_episode_events_order;

-- 覆診安排主表 未使用的索引
DROP INDEX IF EXISTS public.idx_覆診安排_狀態;

-- patient_restraint_assessments 未使用的索引
DROP INDEX IF EXISTS public.idx_patient_restraint_assessments_doctor_signature_date;
DROP INDEX IF EXISTS public.idx_patient_restraint_assessments_next_due_date;

-- patient_logs 未使用的索引
DROP INDEX IF EXISTS public.idx_patient_logs_log_type;

-- hospital_outreach_records 未使用的索引
DROP INDEX IF EXISTS public.idx_hospital_outreach_records_pickup_arrangement;
DROP INDEX IF EXISTS public.idx_hospital_outreach_records_medication_source;
DROP INDEX IF EXISTS public.idx_hospital_outreach_records_medication_end_date;
DROP INDEX IF EXISTS public.idx_hospital_outreach_records_outreach_appointment_date;
DROP INDEX IF EXISTS public.idx_hospital_outreach_records_medication_sources;

-- hospital_outreach_record_history 未使用的索引
DROP INDEX IF EXISTS public.idx_hospital_outreach_record_history_archived_at;
DROP INDEX IF EXISTS public.idx_hospital_outreach_record_history_medication_bag_date;

-- daily_system_tasks 未使用的索引
DROP INDEX IF EXISTS public.idx_daily_system_tasks_task_name;
DROP INDEX IF EXISTS public.idx_daily_system_tasks_task_date;

-- medication_risk_rules 未使用的索引
DROP INDEX IF EXISTS public.idx_medication_risk_rules_rule_type;
DROP INDEX IF EXISTS public.idx_medication_risk_rules_is_active;

-- profiles 未使用的索引
DROP INDEX IF EXISTS public.idx_profiles_院友id;

-- doctor_visit_schedule 未使用的索引
DROP INDEX IF EXISTS public.idx_doctor_visit_schedule_created_at;
DROP INDEX IF EXISTS public.idx_doctor_visit_schedule_doctor_name;
DROP INDEX IF EXISTS public.idx_doctor_visit_schedule_specialty;

-- medication_drug_database 未使用的索引
DROP INDEX IF EXISTS public.idx_medication_drug_database_drug_code;
DROP INDEX IF EXISTS public.idx_medication_drug_database_drug_type;
DROP INDEX IF EXISTS public.idx_medication_drug_database_administration_route;

-- medication_workflow_records 未使用的索引
DROP INDEX IF EXISTS public.idx_medication_workflow_records_verification_status;

-- medication_workflow_settings 未使用的索引
DROP INDEX IF EXISTS public.idx_medication_workflow_settings_user_id;

-- ocr_recognition_logs 未使用的索引
DROP INDEX IF EXISTS public.idx_ocr_logs_user_created;