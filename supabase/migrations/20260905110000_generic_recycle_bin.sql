/*
  # 通用回收筒（Generic Recycle Bin）

  1. deleted_records 表：以 jsonb 儲存被刪資料列原文 + 刪除元數據，
     支援 annual_health_checkups / patient_tube_care_records / wounds / wound_assessments /
     patient_evening_care_plans / care_plans / health_assessments / patient_restraint_assessments /
     覆診安排主表 / hospital_episodes / meal_guidance / incident_reports / infection_control_records
  2. 三個 SECURITY DEFINER RPC（白名單校驗 + facility 檢查）：
     - recycle_soft_delete(p_table, p_id, p_reason)
     - recycle_restore(p_recycle_id)
     - recycle_permanent_delete(p_recycle_id)
  3. RLS：tenant 隔離（同其他院舍表）
*/

CREATE TABLE IF NOT EXISTS deleted_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_table text NOT NULL,
  original_id text NOT NULL,
  data jsonb NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by text,
  deletion_reason text NOT NULL DEFAULT '手動刪除',
  facility_id integer
);

ALTER TABLE deleted_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON deleted_records;
CREATE POLICY "tenant_isolation" ON deleted_records FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

-- 白名單：只允許回收呢啲表（防止動態 SQL 被濫用）
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
    'infection_control_records'
  ]::text[])
$$;

-- 搵表嘅主鍵欄名（全部目標表都係單欄主鍵；覆診安排主表主鍵係「覆診id」）
CREATE OR REPLACE FUNCTION public.recycle_pk_column(p_table text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT a.attname
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
  WHERE i.indrelid = format('%I.%I', 'public', p_table)::regclass
    AND i.indisprimary
  ORDER BY a.attnum
  LIMIT 1
$$;

-- 軟刪除：搬原始列入回收筒，再刪原表列
CREATE OR REPLACE FUNCTION public.recycle_soft_delete(p_table text, p_id text, p_reason text DEFAULT '手動刪除')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_row jsonb;
  v_facility integer;
  v_pk text;
BEGIN
  IF NOT public.recycle_allowed_table(p_table) THEN
    RAISE EXCEPTION '表 % 不在回收白名單內', p_table;
  END IF;

  v_pk := public.recycle_pk_column(p_table);
  IF v_pk IS NULL THEN
    RAISE EXCEPTION '表 % 沒有主鍵，無法回收', p_table;
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM (SELECT * FROM %I WHERE %I::text = $1) t', p_table, v_pk)
    INTO v_row
    USING p_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION '找不到要刪除的記錄';
  END IF;

  v_facility := COALESCE((v_row ->> 'facility_id')::integer, public.jwt_facility_id());

  -- facility 檢查：非維運模式時，只能刪本院舍記錄
  IF NOT (public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) THEN
    IF v_facility IS DISTINCT FROM public.jwt_facility_id() THEN
      RAISE EXCEPTION '只能刪除本院舍的記錄';
    END IF;
  END IF;

  INSERT INTO deleted_records (original_table, original_id, data, deleted_by, deletion_reason, facility_id)
  VALUES (p_table, p_id, v_row, auth.jwt() ->> 'user_name', COALESCE(NULLIF(p_reason, ''), '手動刪除'), v_facility);

  EXECUTE format('DELETE FROM %I WHERE %I::text = $1', p_table, v_pk) USING p_id;
END;
$$;

-- 還原：將資料插返原表，再移除回收筒記錄
CREATE OR REPLACE FUNCTION public.recycle_restore(p_recycle_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_bin deleted_records%ROWTYPE;
BEGIN
  SELECT * INTO v_bin FROM deleted_records WHERE id = p_recycle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '回收筒記錄不存在';
  END IF;
  IF NOT public.recycle_allowed_table(v_bin.original_table) THEN
    RAISE EXCEPTION '表 % 不在回收白名單內', v_bin.original_table;
  END IF;

  IF NOT (public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) THEN
    IF v_bin.facility_id IS DISTINCT FROM public.jwt_facility_id() THEN
      RAISE EXCEPTION '只能還原本院舍的記錄';
    END IF;
  END IF;

  EXECUTE format('INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1)', v_bin.original_table, v_bin.original_table)
    USING v_bin.data;

  DELETE FROM deleted_records WHERE id = p_recycle_id;
END;
$$;

-- 永久刪除：只刪回收筒記錄
CREATE OR REPLACE FUNCTION public.recycle_permanent_delete(p_recycle_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_facility integer;
BEGIN
  SELECT facility_id INTO v_facility FROM deleted_records WHERE id = p_recycle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '回收筒記錄不存在';
  END IF;

  IF NOT (public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) THEN
    IF v_facility IS DISTINCT FROM public.jwt_facility_id() THEN
      RAISE EXCEPTION '只能刪除本院舍的記錄';
    END IF;
  END IF;

  DELETE FROM deleted_records WHERE id = p_recycle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recycle_soft_delete(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recycle_restore(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recycle_permanent_delete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recycle_soft_delete(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recycle_restore(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recycle_permanent_delete(uuid) TO authenticated;
