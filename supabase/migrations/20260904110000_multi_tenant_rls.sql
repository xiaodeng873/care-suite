/*
  # 多租戶改造（第二步）：所有 tenant 表 RLS 改為 claim-based 隔離

  目的：前端登入後持自訂 JWT（HS256，PostgREST 已驗證），claims 含
  user_id / facility_id / user_role。本 migration 將所有 tenant 表
  （P1 已加 facility_id 的 68 張表）的存取改為以 JWT claim 隔離：

  1. developer（user_role = 'developer'，facility_id 為 JSON null）
     可跨院舍存取全部 tenant 表。
  2. 一般用戶只能存取 facility_id 等於自己 claim 的列。
  3. anon（無自訂 claims 的純 anon key）一律被拒絕：
     - 所有 policy 僅 TO authenticated，anon 根本不在 policy 涵蓋範圍；
     - 即使以 authenticated 身分但無 facility_id claim，
       jwt_facility_id() 回傳 NULL，比較結果為 NULL → 拒絕。
  4. 院舍級表（21 張）新增 BEFORE INSERT trigger，由 claim 自動填
     facility_id；service role（無 claim）時保持 NULL，
     由 edge function 顯式指定。
  5. 5 張 view 改 security_invoker = on，避免 view 以 owner 權限
     繞過底表 RLS 造成跨院舍洩漏。
  6. 17 張共用表（藥物資料庫、問題庫、範本等）完全不加 RLS，照舊。

  歷史 policy 名稱有數十種變體，無法列舉，故用 DO block 依
  pg_policies 一次清掉目標表上的所有舊 policy 再重建。

  全部使用 CREATE OR REPLACE / DROP ... IF EXISTS 防重跑；
  不 DROP 任何 TABLE / FUNCTION / VIEW（POLICY 除外）。
*/

-- ============================================================
-- 1. Helper functions：由 JWT claims 讀取租戶資訊
-- ============================================================

CREATE OR REPLACE FUNCTION public.jwt_facility_id() RETURNS integer
LANGUAGE sql STABLE AS $$ SELECT NULLIF(auth.jwt() ->> 'facility_id','')::integer $$;

COMMENT ON FUNCTION public.jwt_facility_id() IS '自訂 JWT claim 讀取目前用戶所屬院舍編號；developer 或無 claim 時回傳 NULL';

CREATE OR REPLACE FUNCTION public.jwt_is_developer() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT (auth.jwt() ->> 'user_role') = 'developer' $$;

COMMENT ON FUNCTION public.jwt_is_developer() IS '自訂 JWT claim 判斷是否 developer 角色（跨院舍）；claim 不存在時回傳 NULL（視為否）';

CREATE OR REPLACE FUNCTION public.jwt_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(auth.jwt() ->> 'user_id','')::uuid $$;

COMMENT ON FUNCTION public.jwt_user_id() IS '自訂 JWT claim 讀取目前用戶的 user_profiles.id';

-- 院舍級表 INSERT 時自動填 facility_id；
-- 服務端角色（無 claim）時保持 NULL，由 edge function 顯式指定
CREATE OR REPLACE FUNCTION public.set_facility_id_from_claim() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.facility_id IS NULL THEN
    NEW.facility_id := public.jwt_facility_id();
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.set_facility_id_from_claim() IS '院舍級表 INSERT 時由 JWT claim 自動填入 facility_id；服務端角色（無 claim）時保持 NULL，由 edge function 顯式指定';

-- ============================================================
-- 2. 清掉目標表上的全部歷史 policy（名稱變體太多，改依
--    pg_policies 系統檢視表列舉後逐一 DROP）
-- ============================================================

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        -- 院友級 tenant 表（46 張）
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
        -- 院舍級 tenant 表（21 張）
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
        'user_profiles',
        -- 其餘 tenant 相關表
        'facilities',
        'user_sessions'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 3. Tenant 隔離 policy（全部僅 TO authenticated，anon 不在
--    涵蓋範圍；developer 跨院舍，一般用戶限本院舍）
-- ============================================================

-- 3a. 院友級表（46 張，通用版：facility_id = claim）

ALTER TABLE "健康監測記錄" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "健康監測記錄" FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE "覆診安排主表" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "覆診安排主表" FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE "看診院友細項" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "看診院友細項" FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE hospital_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON hospital_episodes FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE medication_workflow_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON medication_workflow_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE wounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON wounds FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE prescription_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON prescription_activity_log FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE hospital_outreach_record_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON hospital_outreach_record_history FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE vaccination_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON vaccination_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE cgat_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON cgat_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE diaper_change_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON diaper_change_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE hygiene_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON hygiene_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE diaper_usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON diaper_usage_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_admission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_admission_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patrol_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patrol_rounds FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_notes FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_logs FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_tube_care_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_tube_care_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON care_plans FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE intake_output_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON intake_output_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE rehab_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON rehab_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE meal_guidance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON meal_guidance FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE bed_transfer_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON bed_transfer_log FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE wound_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON wound_assessments FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON incident_reports FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE health_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON health_assessments FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_fee_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_fee_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE annual_health_checkups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON annual_health_checkups FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE position_change_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON position_change_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_health_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_health_tasks FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE diagnosis_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON diagnosis_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE infection_control_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON infection_control_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_restraint_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_restraint_assessments FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE new_medication_prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON new_medication_prescriptions FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_activity_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_activity_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_care_tabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_care_tabs FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE hospital_outreach_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON hospital_outreach_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_evening_care_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_evening_care_plans FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE restraint_observation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON restraint_observation_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE patient_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON patient_contacts FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE deleted_health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON deleted_health_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE care_plan_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON care_plan_problems FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE care_plan_nursing_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON care_plan_nursing_needs FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE episode_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON episode_events FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE "到診院友_看診原因" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "到診院友_看診原因" FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE "院友主表" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "院友主表" FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

-- 3b. medication_workflow_settings（patient_id 可 NULL = 全院舍共用列，
--     facility_id 為 NULL 的列所有院舍可讀寫）

ALTER TABLE medication_workflow_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON medication_workflow_settings FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id IS NULL OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id IS NULL OR facility_id = public.jwt_facility_id());

-- 3c. 院舍級表（21 張，通用版：facility_id = claim）

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON stations FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON rooms FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON beds FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE station_shift_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON station_shift_settings FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_shift_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_shift_assignments FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE "到診排程主表" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "到診排程主表" FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE doctor_visit_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON doctor_visit_schedule FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE facility_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON facility_settings FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE fee_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON fee_items FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_absence_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_absence_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_annual_leave_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_annual_leave_details FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_balance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_balance_adjustments FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_employment_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_employment_details FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_leave_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_leave_records FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_ocr_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_ocr_prompts FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_public_holiday_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_public_holiday_details FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_rest_day_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_rest_day_details FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_permissions FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE daily_system_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON daily_system_tasks FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

ALTER TABLE emergency_operation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON emergency_operation_log FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

-- 3d. user_profiles 專用版：用戶必須能讀寫自己的列，
--     即使 facility 有變動

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_profiles FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id() OR id = public.jwt_user_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id() OR id = public.jwt_user_id());

-- 3e. user_sessions：僅本人（或 developer）

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_session_only" ON user_sessions FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR user_id = public.jwt_user_id())
  WITH CHECK (public.jwt_is_developer() OR user_id = public.jwt_user_id());

-- 3f. facilities：一般用戶只讀自己院舍；
--     新增/修改院舍只限 developer（開通功能走 service role）

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_facility" ON facilities FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer());

COMMENT ON POLICY "read_own_facility" ON facilities IS '一般用戶只讀自己院舍；新增/修改院舍只限 developer（開通功能走 service role）';

-- ============================================================
-- 4. 院舍級表 trigger：INSERT 時由 claim 自動填 facility_id
--    （service role 無 claim 時保持 NULL，由 edge function 指定）
-- ============================================================

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_stations ON stations;
CREATE TRIGGER trg_set_facility_from_claim_stations BEFORE INSERT ON stations
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_rooms ON rooms;
CREATE TRIGGER trg_set_facility_from_claim_rooms BEFORE INSERT ON rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_beds ON beds;
CREATE TRIGGER trg_set_facility_from_claim_beds BEFORE INSERT ON beds
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_station_shift_settings ON station_shift_settings;
CREATE TRIGGER trg_set_facility_from_claim_station_shift_settings BEFORE INSERT ON station_shift_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_shift_assignments ON user_shift_assignments;
CREATE TRIGGER trg_set_facility_from_claim_user_shift_assignments BEFORE INSERT ON user_shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_visit_schedule ON "到診排程主表";
CREATE TRIGGER trg_set_facility_from_claim_visit_schedule BEFORE INSERT ON "到診排程主表"
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_doctor_visit_schedule ON doctor_visit_schedule;
CREATE TRIGGER trg_set_facility_from_claim_doctor_visit_schedule BEFORE INSERT ON doctor_visit_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_facility_settings ON facility_settings;
CREATE TRIGGER trg_set_facility_from_claim_facility_settings BEFORE INSERT ON facility_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_fee_items ON fee_items;
CREATE TRIGGER trg_set_facility_from_claim_fee_items BEFORE INSERT ON fee_items
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_absence_records ON user_absence_records;
CREATE TRIGGER trg_set_facility_from_claim_user_absence_records BEFORE INSERT ON user_absence_records
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_annual_leave_details ON user_annual_leave_details;
CREATE TRIGGER trg_set_facility_from_claim_user_annual_leave_details BEFORE INSERT ON user_annual_leave_details
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_balance_adjustments ON user_balance_adjustments;
CREATE TRIGGER trg_set_facility_from_claim_user_balance_adjustments BEFORE INSERT ON user_balance_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_employment_details ON user_employment_details;
CREATE TRIGGER trg_set_facility_from_claim_user_employment_details BEFORE INSERT ON user_employment_details
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_leave_records ON user_leave_records;
CREATE TRIGGER trg_set_facility_from_claim_user_leave_records BEFORE INSERT ON user_leave_records
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_ocr_prompts ON user_ocr_prompts;
CREATE TRIGGER trg_set_facility_from_claim_user_ocr_prompts BEFORE INSERT ON user_ocr_prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_public_holiday_details ON user_public_holiday_details;
CREATE TRIGGER trg_set_facility_from_claim_user_public_holiday_details BEFORE INSERT ON user_public_holiday_details
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_rest_day_details ON user_rest_day_details;
CREATE TRIGGER trg_set_facility_from_claim_user_rest_day_details BEFORE INSERT ON user_rest_day_details
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_permissions ON user_permissions;
CREATE TRIGGER trg_set_facility_from_claim_user_permissions BEFORE INSERT ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_daily_system_tasks ON daily_system_tasks;
CREATE TRIGGER trg_set_facility_from_claim_daily_system_tasks BEFORE INSERT ON daily_system_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_emergency_operation_log ON emergency_operation_log;
CREATE TRIGGER trg_set_facility_from_claim_emergency_operation_log BEFORE INSERT ON emergency_operation_log
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_user_profiles ON user_profiles;
CREATE TRIGGER trg_set_facility_from_claim_user_profiles BEFORE INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

-- 院友主表是 tenant 邊界根、無法自院友派生，INSERT 時直接取登入者 claim 的院舍
DROP TRIGGER IF EXISTS trg_set_facility_from_claim_patients ON "院友主表";
CREATE TRIGGER trg_set_facility_from_claim_patients BEFORE INSERT ON "院友主表"
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

-- ============================================================
-- 5. Views 改 security_invoker = on
--    （否則 view 以 owner 權限繞過底表 RLS，造成跨院舍洩漏；
--      調用者的 RLS 會套用到底表，行為正確）
-- ============================================================

ALTER VIEW wound_summary SET (security_invoker = on);
ALTER VIEW patient_wound_stats SET (security_invoker = on);
ALTER VIEW "健康監測_會話視圖" SET (security_invoker = on);
ALTER VIEW prescription_workflow_records SET (security_invoker = on);
ALTER VIEW medication_workflow_duplicate_stats SET (security_invoker = on);
