/*
  新增 cgat_records.cgat_visit_unknown 欄位
  - 允許「CGAT 到診日期」標記為「未知」，此時 cgat_visit_date 可為空
  - 將 followup_date 改名為 cgat_visit_date，以區分 CGAT 到診日期與預計藥完日期
  - 棄用 cgat_followup_before_end_date check constraint（藥完日期改由療程周數計算）
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cgat_records' AND column_name = 'followup_date'
  ) THEN
    ALTER TABLE cgat_records RENAME COLUMN followup_date TO cgat_visit_date;
  END IF;
END $$;

ALTER TABLE cgat_records
  ADD COLUMN IF NOT EXISTS cgat_visit_unknown boolean DEFAULT false;

ALTER TABLE cgat_records
  DROP CONSTRAINT IF EXISTS cgat_followup_before_end_date;
