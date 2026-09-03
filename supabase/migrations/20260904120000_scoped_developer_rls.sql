/*
  # 多租戶改造（P2 修正）：developer 改為「選定院舍」模式

  背景：developer 登入後原設計為跨院舍看到全部資料；院主要求 developer
  登入時選定一間院舍，只操作該院舍資料（權限仍是 developer）。

  做法：tenant 表的 policy 改為——
    - developer 且 token 未鎖定院舍（facility_id claim 為 NULL）→ 全部可見（維運模式）
    - 否則只見 facility_id = token 院舍 的資料
  user_sessions / facilities 維持原 policy 不變。
*/

DROP POLICY IF EXISTS "tenant_isolation" ON "健康監測記錄";
CREATE POLICY "tenant_isolation" ON "健康監測記錄" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "覆診安排主表";
CREATE POLICY "tenant_isolation" ON "覆診安排主表" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "看診院友細項";
CREATE POLICY "tenant_isolation" ON "看診院友細項" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON hospital_episodes;
CREATE POLICY "tenant_isolation" ON hospital_episodes FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON medication_workflow_records;
CREATE POLICY "tenant_isolation" ON medication_workflow_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON wounds;
CREATE POLICY "tenant_isolation" ON wounds FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON prescription_activity_log;
CREATE POLICY "tenant_isolation" ON prescription_activity_log FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON hospital_outreach_record_history;
CREATE POLICY "tenant_isolation" ON hospital_outreach_record_history FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON vaccination_records;
CREATE POLICY "tenant_isolation" ON vaccination_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON cgat_records;
CREATE POLICY "tenant_isolation" ON cgat_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON diaper_change_records;
CREATE POLICY "tenant_isolation" ON diaper_change_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON hygiene_records;
CREATE POLICY "tenant_isolation" ON hygiene_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON diaper_usage_records;
CREATE POLICY "tenant_isolation" ON diaper_usage_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_admission_records;
CREATE POLICY "tenant_isolation" ON patient_admission_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patrol_rounds;
CREATE POLICY "tenant_isolation" ON patrol_rounds FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_notes;
CREATE POLICY "tenant_isolation" ON patient_notes FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_logs;
CREATE POLICY "tenant_isolation" ON patient_logs FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_tube_care_records;
CREATE POLICY "tenant_isolation" ON patient_tube_care_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON care_plans;
CREATE POLICY "tenant_isolation" ON care_plans FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON intake_output_records;
CREATE POLICY "tenant_isolation" ON intake_output_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON rehab_records;
CREATE POLICY "tenant_isolation" ON rehab_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON meal_guidance;
CREATE POLICY "tenant_isolation" ON meal_guidance FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON bed_transfer_log;
CREATE POLICY "tenant_isolation" ON bed_transfer_log FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON wound_assessments;
CREATE POLICY "tenant_isolation" ON wound_assessments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON incident_reports;
CREATE POLICY "tenant_isolation" ON incident_reports FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON health_assessments;
CREATE POLICY "tenant_isolation" ON health_assessments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_fee_records;
CREATE POLICY "tenant_isolation" ON patient_fee_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON annual_health_checkups;
CREATE POLICY "tenant_isolation" ON annual_health_checkups FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON position_change_records;
CREATE POLICY "tenant_isolation" ON position_change_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_health_tasks;
CREATE POLICY "tenant_isolation" ON patient_health_tasks FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON diagnosis_records;
CREATE POLICY "tenant_isolation" ON diagnosis_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON infection_control_records;
CREATE POLICY "tenant_isolation" ON infection_control_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_restraint_assessments;
CREATE POLICY "tenant_isolation" ON patient_restraint_assessments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON new_medication_prescriptions;
CREATE POLICY "tenant_isolation" ON new_medication_prescriptions FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_activity_records;
CREATE POLICY "tenant_isolation" ON patient_activity_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_care_tabs;
CREATE POLICY "tenant_isolation" ON patient_care_tabs FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON hospital_outreach_records;
CREATE POLICY "tenant_isolation" ON hospital_outreach_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_evening_care_plans;
CREATE POLICY "tenant_isolation" ON patient_evening_care_plans FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON restraint_observation_records;
CREATE POLICY "tenant_isolation" ON restraint_observation_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON patient_contacts;
CREATE POLICY "tenant_isolation" ON patient_contacts FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON deleted_health_records;
CREATE POLICY "tenant_isolation" ON deleted_health_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON care_plan_problems;
CREATE POLICY "tenant_isolation" ON care_plan_problems FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON care_plan_nursing_needs;
CREATE POLICY "tenant_isolation" ON care_plan_nursing_needs FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON episode_events;
CREATE POLICY "tenant_isolation" ON episode_events FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "到診院友_看診原因";
CREATE POLICY "tenant_isolation" ON "到診院友_看診原因" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "院友主表";
CREATE POLICY "tenant_isolation" ON "院友主表" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON medication_workflow_settings;
CREATE POLICY "tenant_isolation" ON medication_workflow_settings FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id IS NULL OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id IS NULL OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON stations;
CREATE POLICY "tenant_isolation" ON stations FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON rooms;
CREATE POLICY "tenant_isolation" ON rooms FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON beds;
CREATE POLICY "tenant_isolation" ON beds FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON station_shift_settings;
CREATE POLICY "tenant_isolation" ON station_shift_settings FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_shift_assignments;
CREATE POLICY "tenant_isolation" ON user_shift_assignments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "到診排程主表";
CREATE POLICY "tenant_isolation" ON "到診排程主表" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON doctor_visit_schedule;
CREATE POLICY "tenant_isolation" ON doctor_visit_schedule FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON facility_settings;
CREATE POLICY "tenant_isolation" ON facility_settings FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON fee_items;
CREATE POLICY "tenant_isolation" ON fee_items FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_absence_records;
CREATE POLICY "tenant_isolation" ON user_absence_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_annual_leave_details;
CREATE POLICY "tenant_isolation" ON user_annual_leave_details FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_balance_adjustments;
CREATE POLICY "tenant_isolation" ON user_balance_adjustments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_employment_details;
CREATE POLICY "tenant_isolation" ON user_employment_details FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_leave_records;
CREATE POLICY "tenant_isolation" ON user_leave_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_ocr_prompts;
CREATE POLICY "tenant_isolation" ON user_ocr_prompts FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_public_holiday_details;
CREATE POLICY "tenant_isolation" ON user_public_holiday_details FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_rest_day_details;
CREATE POLICY "tenant_isolation" ON user_rest_day_details FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_permissions;
CREATE POLICY "tenant_isolation" ON user_permissions FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON daily_system_tasks;
CREATE POLICY "tenant_isolation" ON daily_system_tasks FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON emergency_operation_log;
CREATE POLICY "tenant_isolation" ON emergency_operation_log FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

DROP POLICY IF EXISTS "tenant_isolation" ON user_profiles;
CREATE POLICY "tenant_isolation" ON user_profiles FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

