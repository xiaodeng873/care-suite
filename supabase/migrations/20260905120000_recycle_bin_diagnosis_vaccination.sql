-- 回收筒白名單新增：診斷記錄、疫苗記錄
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
    'diagnosis_records',
    'vaccination_records'
  ]::text[])
$$;
