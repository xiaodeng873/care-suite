-- 回收筒白名單新增：院友主表、new_medication_prescriptions
-- （AB站名單重匯入需要軟刪除院友同待變更處方，兩表都有 facility_id 做 tenant 隔離）

CREATE OR REPLACE FUNCTION public.recycle_allowed_table(p_table text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_table = ANY (ARRAY[
    'annual_health_checkups',
    'patient_tube_care_records',
    'wounds',
    'wound_assessments',
    'patient_evening_care_plans',
    'care_plans',
    'health_assessments',
    'patient_restraint_assessments',
    '覆診安排主表',
    'hospital_episodes',
    'meal_guidance',
    'incident_reports',
    'infection_control_records',
    '院友主表',
    'new_medication_prescriptions'
  ]::text[])
$$;
