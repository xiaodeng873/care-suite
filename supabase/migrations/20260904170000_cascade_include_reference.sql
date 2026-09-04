-- delete_facility_cascade 加入參考資料表（院舍化後一併清除）

-- 刪除院舍（連同所有用戶及記錄）：developer 專用 RPC
-- SECURITY DEFINER 繞過 RLS 逐表清刪；FK 相依次序不固定，反覆多輪直到清空

CREATE OR REPLACE FUNCTION public.delete_facility_cascade(p_facility_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  leftover record;
  v_tables text[] := ARRAY[
    '健康監測記錄',
    '覆診安排主表',
    '看診院友細項',
    'hospital_episodes',
    'medication_workflow_records',
    'wounds',
    'prescription_activity_log',
    'hospital_outreach_record_history',
    'vaccination_records',
    'cgat_records',
    'diaper_change_records',
    'hygiene_records',
    'diaper_usage_records',
    'patient_admission_records',
    'patrol_rounds',
    'patient_notes',
    'patient_logs',
    'patient_tube_care_records',
    'care_plans',
    'intake_output_records',
    'rehab_records',
    'meal_guidance',
    'bed_transfer_log',
    'wound_assessments',
    'incident_reports',
    'health_assessments',
    'patient_fee_records',
    'annual_health_checkups',
    'position_change_records',
    'patient_health_tasks',
    'diagnosis_records',
    'infection_control_records',
    'patient_restraint_assessments',
    'new_medication_prescriptions',
    'patient_activity_records',
    'patient_care_tabs',
    'hospital_outreach_records',
    'patient_evening_care_plans',
    'restraint_observation_records',
    'patient_contacts',
    'deleted_health_records',
    'care_plan_problems',
    'care_plan_nursing_needs',
    'episode_events',
    '到診院友_看診原因',
    '院友主表',
    'medication_workflow_settings',
    'stations',
    'rooms',
    'beds',
    'station_shift_settings',
    'user_shift_assignments',
    '到診排程主表',
    'doctor_visit_schedule',
    'facility_settings',
    'fee_items',
    'user_absence_records',
    'user_annual_leave_details',
    'user_balance_adjustments',
    'user_employment_details',
    'user_leave_records',
    'user_ocr_prompts',
    'user_public_holiday_details',
    'user_rest_day_details',
    'user_permissions',
    'daily_system_tasks',
    'emergency_operation_log',
    'medication_drug_database',
    'problem_library',
    'incident_preset_options',
    '看診原因選項',
    'nursing_need_items',
    'intake_items',
    'output_items',
    'ocr_prompt_templates',
    'templates_metadata',
    'medication_risk_rules',
    'user_profiles'
  ];
BEGIN
  IF NOT public.jwt_is_developer() THEN
    RAISE EXCEPTION '只有開發者可以刪除院舍';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.facilities WHERE id = p_facility_id) THEN
    RAISE EXCEPTION '院舍不存在';
  END IF;

  -- 該院舍用戶的登入 session（user_sessions 無 facility_id）
  DELETE FROM public.user_sessions
    WHERE user_id IN (SELECT id FROM public.user_profiles WHERE facility_id = p_facility_id);

  -- 反覆清刪 tenant 表（子表可能攔截父表刪除，多輪直到全部清空）
  FOR round IN 1..6 LOOP
    FOREACH t IN ARRAY v_tables LOOP
      BEGIN
        EXECUTE format('DELETE FROM %I WHERE facility_id = $1', t) USING p_facility_id;
      EXCEPTION WHEN others THEN
        NULL; -- 留待下一輪
      END;
    END LOOP;
  END LOOP;

  -- 驗證：仍有殘留即報錯（避免半刪狀態）
  FOREACH t IN ARRAY v_tables LOOP
    EXECUTE format('SELECT 1 FROM %I WHERE facility_id = $1 LIMIT 1', t)
      USING p_facility_id
      INTO leftover;
    IF FOUND THEN
      RAISE EXCEPTION '院舍資料未能完全清除（表 %），已回復', t;
    END IF;
  END LOOP;

  DELETE FROM public.facility_settings WHERE facility_id = p_facility_id;
  DELETE FROM public.facilities WHERE id = p_facility_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_facility_cascade(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_facility_cascade(integer) TO authenticated;

COMMENT ON FUNCTION public.delete_facility_cascade(integer) IS '刪除院舍及其所有用戶與記錄；只限 developer，驗證未清空會回復（函數內異常回滾）';
