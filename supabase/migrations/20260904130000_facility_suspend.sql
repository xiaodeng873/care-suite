/*
  # 多租戶改造（P2 修正 2）：院舍停用（中止登入）機制

  1. facilities 加 auth_epoch：中止登入時 +1，已簽發的 dbToken 即失效
  2. jwt_facility_active()：token 對應院舍必須啟用中且 epoch 相符
  3. 67 張 tenant 表 policy 加入「院舍啟用中」檢查：
     - 未鎖定院舍的 developer（維運）不變
     - 一般/已鎖定院舍的用戶：facility_id 相符 且 院舍啟用中 且 epoch 相符
  user_profiles / user_sessions / facilities 維持原 policy。
*/

ALTER TABLE facilities ADD COLUMN IF NOT EXISTS auth_epoch integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN facilities.auth_epoch IS '登入權杖版號；中止院舍登入時 +1，舊 dbToken 全部失效';

CREATE OR REPLACE FUNCTION public.jwt_facility_active() RETURNS boolean
LANGUAGE sql STABLE AS $func$
  SELECT COALESCE((
    SELECT is_active AND auth_epoch = NULLIF(auth.jwt() ->> 'epoch', '')::int
    FROM facilities
    WHERE id = public.jwt_facility_id()
  ), true)
$func$;

DROP POLICY IF EXISTS "tenant_isolation" ON "健康監測記錄";
CREATE POLICY "tenant_isolation" ON "健康監測記錄" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON "覆診安排主表";
CREATE POLICY "tenant_isolation" ON "覆診安排主表" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON "看診院友細項";
CREATE POLICY "tenant_isolation" ON "看診院友細項" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON hospital_episodes;
CREATE POLICY "tenant_isolation" ON hospital_episodes FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON medication_workflow_records;
CREATE POLICY "tenant_isolation" ON medication_workflow_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON wounds;
CREATE POLICY "tenant_isolation" ON wounds FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON prescription_activity_log;
CREATE POLICY "tenant_isolation" ON prescription_activity_log FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON hospital_outreach_record_history;
CREATE POLICY "tenant_isolation" ON hospital_outreach_record_history FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON vaccination_records;
CREATE POLICY "tenant_isolation" ON vaccination_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON cgat_records;
CREATE POLICY "tenant_isolation" ON cgat_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON diaper_change_records;
CREATE POLICY "tenant_isolation" ON diaper_change_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON hygiene_records;
CREATE POLICY "tenant_isolation" ON hygiene_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON diaper_usage_records;
CREATE POLICY "tenant_isolation" ON diaper_usage_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_admission_records;
CREATE POLICY "tenant_isolation" ON patient_admission_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patrol_rounds;
CREATE POLICY "tenant_isolation" ON patrol_rounds FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_notes;
CREATE POLICY "tenant_isolation" ON patient_notes FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_logs;
CREATE POLICY "tenant_isolation" ON patient_logs FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_tube_care_records;
CREATE POLICY "tenant_isolation" ON patient_tube_care_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON care_plans;
CREATE POLICY "tenant_isolation" ON care_plans FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON intake_output_records;
CREATE POLICY "tenant_isolation" ON intake_output_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON rehab_records;
CREATE POLICY "tenant_isolation" ON rehab_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON meal_guidance;
CREATE POLICY "tenant_isolation" ON meal_guidance FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON bed_transfer_log;
CREATE POLICY "tenant_isolation" ON bed_transfer_log FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON wound_assessments;
CREATE POLICY "tenant_isolation" ON wound_assessments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON incident_reports;
CREATE POLICY "tenant_isolation" ON incident_reports FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON health_assessments;
CREATE POLICY "tenant_isolation" ON health_assessments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_fee_records;
CREATE POLICY "tenant_isolation" ON patient_fee_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON annual_health_checkups;
CREATE POLICY "tenant_isolation" ON annual_health_checkups FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON position_change_records;
CREATE POLICY "tenant_isolation" ON position_change_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_health_tasks;
CREATE POLICY "tenant_isolation" ON patient_health_tasks FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON diagnosis_records;
CREATE POLICY "tenant_isolation" ON diagnosis_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON infection_control_records;
CREATE POLICY "tenant_isolation" ON infection_control_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_restraint_assessments;
CREATE POLICY "tenant_isolation" ON patient_restraint_assessments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON new_medication_prescriptions;
CREATE POLICY "tenant_isolation" ON new_medication_prescriptions FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_activity_records;
CREATE POLICY "tenant_isolation" ON patient_activity_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_care_tabs;
CREATE POLICY "tenant_isolation" ON patient_care_tabs FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON hospital_outreach_records;
CREATE POLICY "tenant_isolation" ON hospital_outreach_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_evening_care_plans;
CREATE POLICY "tenant_isolation" ON patient_evening_care_plans FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON restraint_observation_records;
CREATE POLICY "tenant_isolation" ON restraint_observation_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON patient_contacts;
CREATE POLICY "tenant_isolation" ON patient_contacts FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON deleted_health_records;
CREATE POLICY "tenant_isolation" ON deleted_health_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON care_plan_problems;
CREATE POLICY "tenant_isolation" ON care_plan_problems FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON care_plan_nursing_needs;
CREATE POLICY "tenant_isolation" ON care_plan_nursing_needs FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON episode_events;
CREATE POLICY "tenant_isolation" ON episode_events FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON "到診院友_看診原因";
CREATE POLICY "tenant_isolation" ON "到診院友_看診原因" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON "院友主表";
CREATE POLICY "tenant_isolation" ON "院友主表" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON medication_workflow_settings;
CREATE POLICY "tenant_isolation" ON medication_workflow_settings FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id IS NULL OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id IS NULL OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON stations;
CREATE POLICY "tenant_isolation" ON stations FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON rooms;
CREATE POLICY "tenant_isolation" ON rooms FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON beds;
CREATE POLICY "tenant_isolation" ON beds FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON station_shift_settings;
CREATE POLICY "tenant_isolation" ON station_shift_settings FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_shift_assignments;
CREATE POLICY "tenant_isolation" ON user_shift_assignments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON "到診排程主表";
CREATE POLICY "tenant_isolation" ON "到診排程主表" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON doctor_visit_schedule;
CREATE POLICY "tenant_isolation" ON doctor_visit_schedule FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON facility_settings;
CREATE POLICY "tenant_isolation" ON facility_settings FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON fee_items;
CREATE POLICY "tenant_isolation" ON fee_items FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_absence_records;
CREATE POLICY "tenant_isolation" ON user_absence_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_annual_leave_details;
CREATE POLICY "tenant_isolation" ON user_annual_leave_details FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_balance_adjustments;
CREATE POLICY "tenant_isolation" ON user_balance_adjustments FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_employment_details;
CREATE POLICY "tenant_isolation" ON user_employment_details FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_leave_records;
CREATE POLICY "tenant_isolation" ON user_leave_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_ocr_prompts;
CREATE POLICY "tenant_isolation" ON user_ocr_prompts FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_public_holiday_details;
CREATE POLICY "tenant_isolation" ON user_public_holiday_details FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_rest_day_details;
CREATE POLICY "tenant_isolation" ON user_rest_day_details FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON user_permissions;
CREATE POLICY "tenant_isolation" ON user_permissions FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON daily_system_tasks;
CREATE POLICY "tenant_isolation" ON daily_system_tasks FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP POLICY IF EXISTS "tenant_isolation" ON emergency_operation_log;
CREATE POLICY "tenant_isolation" ON emergency_operation_log FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

