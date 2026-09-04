-- 參考資料表院舍化：加 facility_id + tenant RLS + INSERT trigger + 開通複製（以 facility 1 做種）
-- 純複製、不做同步：各院舍自行維護自己的複製品

-- 1. 加欄位 + backfill 全歸 facility 1
ALTER TABLE medication_drug_database ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE medication_drug_database SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE problem_library ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE problem_library SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE incident_preset_options ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE incident_preset_options SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE "看診原因選項" ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE "看診原因選項" SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE nursing_need_items ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE nursing_need_items SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE intake_items SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE output_items ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE output_items SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE ocr_prompt_templates ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE ocr_prompt_templates SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE templates_metadata ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE templates_metadata SET facility_id = 1 WHERE facility_id IS NULL;
ALTER TABLE medication_risk_rules ADD COLUMN IF NOT EXISTS facility_id integer REFERENCES facilities(id);
UPDATE medication_risk_rules SET facility_id = 1 WHERE facility_id IS NULL;

-- 2. 清除舊全開政策，重建 tenant 隔離 + trigger
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medication_drug_database' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'medication_drug_database');
  END LOOP;
END $$;

ALTER TABLE medication_drug_database ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON medication_drug_database FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_6d656469636174696f6e5f647275675f6461746162617365 ON medication_drug_database;
CREATE TRIGGER trg_set_facility_from_claim_6d656469636174696f6e5f647275675f6461746162617365 BEFORE INSERT ON medication_drug_database
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_library' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'problem_library');
  END LOOP;
END $$;

ALTER TABLE problem_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON problem_library FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_70726f626c656d5f6c696272617279 ON problem_library;
CREATE TRIGGER trg_set_facility_from_claim_70726f626c656d5f6c696272617279 BEFORE INSERT ON problem_library
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'incident_preset_options' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'incident_preset_options');
  END LOOP;
END $$;

ALTER TABLE incident_preset_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON incident_preset_options FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_696e636964656e745f7072657365745f6f7074696f6e73 ON incident_preset_options;
CREATE TRIGGER trg_set_facility_from_claim_696e636964656e745f7072657365745f6f7074696f6e73 BEFORE INSERT ON incident_preset_options
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = '看診原因選項' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, '看診原因選項');
  END LOOP;
END $$;

ALTER TABLE "看診原因選項" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "看診原因選項" FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_t_e79c8be8a8bae58e9fe59ba0e981b8e9a085 ON "看診原因選項";
CREATE TRIGGER trg_set_facility_from_claim_t_e79c8be8a8bae58e9fe59ba0e981b8e9a085 BEFORE INSERT ON "看診原因選項"
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nursing_need_items' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'nursing_need_items');
  END LOOP;
END $$;

ALTER TABLE nursing_need_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON nursing_need_items FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_6e757273696e675f6e6565645f6974656d73 ON nursing_need_items;
CREATE TRIGGER trg_set_facility_from_claim_6e757273696e675f6e6565645f6974656d73 BEFORE INSERT ON nursing_need_items
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'intake_items' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'intake_items');
  END LOOP;
END $$;

ALTER TABLE intake_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON intake_items FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_696e74616b655f6974656d73 ON intake_items;
CREATE TRIGGER trg_set_facility_from_claim_696e74616b655f6974656d73 BEFORE INSERT ON intake_items
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'output_items' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'output_items');
  END LOOP;
END $$;

ALTER TABLE output_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON output_items FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_6f75747075745f6974656d73 ON output_items;
CREATE TRIGGER trg_set_facility_from_claim_6f75747075745f6974656d73 BEFORE INSERT ON output_items
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ocr_prompt_templates' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'ocr_prompt_templates');
  END LOOP;
END $$;

ALTER TABLE ocr_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON ocr_prompt_templates FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_6f63725f70726f6d70745f74656d706c61746573 ON ocr_prompt_templates;
CREATE TRIGGER trg_set_facility_from_claim_6f63725f70726f6d70745f74656d706c61746573 BEFORE INSERT ON ocr_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'templates_metadata' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'templates_metadata');
  END LOOP;
END $$;

ALTER TABLE templates_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON templates_metadata FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_74656d706c617465735f6d65746164617461 ON templates_metadata;
CREATE TRIGGER trg_set_facility_from_claim_74656d706c617465735f6d65746164617461 BEFORE INSERT ON templates_metadata
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medication_risk_rules' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, 'medication_risk_rules');
  END LOOP;
END $$;

ALTER TABLE medication_risk_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON medication_risk_rules FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()))
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL)
         OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active()));

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_6d656469636174696f6e5f7269736b5f72756c6573 ON medication_risk_rules;
CREATE TRIGGER trg_set_facility_from_claim_6d656469636174696f6e5f7269736b5f72756c6573 BEFORE INSERT ON medication_risk_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

-- 3. 開通複製：developer 新增院舍後，把 facility 1 的參考資料複製給新院舍
CREATE OR REPLACE FUNCTION public.provision_facility(p_new_facility_id integer, p_source_facility_id integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  cols text;
  v_tables text[] := ARRAY[
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
    'fee_items',
    'medication_workflow_settings'
  ];
BEGIN
  IF NOT public.jwt_is_developer() THEN
    RAISE EXCEPTION '只有開發者可以執行開通';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.facilities WHERE id = p_new_facility_id) THEN
    RAISE EXCEPTION '院舍不存在';
  END IF;

  FOREACH t IN ARRAY v_tables LOOP
    SELECT string_agg(quote_ident(column_name), ', ') INTO cols
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name <> 'id';
    IF cols IS NOT NULL THEN
      EXECUTE format('INSERT INTO public.%I (%s, facility_id) SELECT %s, $1 FROM public.%I WHERE facility_id = $2',
        t, cols, cols, t)
        USING p_new_facility_id, p_source_facility_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_facility(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_facility(integer, integer) TO authenticated;

COMMENT ON FUNCTION public.provision_facility(integer, integer) IS '開通新院舍：以 facility 1 為種複製參考資料（藥物庫、ICP問題庫、收費項目等），各院舍之後自行維護';
