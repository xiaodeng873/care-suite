-- Add civil servant eligibility as a first-level resident attribute.
ALTER TABLE public."院友主表"
ADD COLUMN IF NOT EXISTS "公務員" text;

ALTER TABLE public."院友主表"
DROP CONSTRAINT IF EXISTS "院友主表_公務員_check";

ALTER TABLE public."院友主表"
ADD CONSTRAINT "院友主表_公務員_check"
CHECK ("公務員" IS NULL OR "公務員" IN ('公務員本人', '公務員家屬'));

UPDATE public."院友主表"
SET
  "公務員" = CASE
    WHEN NULLIF("社會福利"->>'subtype', '') IN ('公務員本人', '公務員家屬') THEN NULLIF("社會福利"->>'subtype', '')
    ELSE "公務員"
  END,
  "社會福利" = jsonb_build_object('type', '', 'subtype', '')
WHERE "社會福利"->>'type' = '公務員'
  AND "公務員" IS NULL;