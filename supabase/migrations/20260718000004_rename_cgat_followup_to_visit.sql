/*
  區分 CGAT 到診日期與預計藥完日期
  - followup_date / followup_unknown 改名為 cgat_visit_date / cgat_visit_unknown
  - 預計藥完日期 (medication_end_date) 改由前端根據 CGAT 到診日期 + 療程周數計算
  - 移除 followup_date <= medication_end_date 的 check constraint
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cgat_records' AND column_name = 'followup_date'
  ) THEN
    ALTER TABLE cgat_records RENAME COLUMN followup_date TO cgat_visit_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cgat_records' AND column_name = 'followup_unknown'
  ) THEN
    ALTER TABLE cgat_records RENAME COLUMN followup_unknown TO cgat_visit_unknown;
  END IF;
END $$;

ALTER TABLE cgat_records
  DROP CONSTRAINT IF EXISTS cgat_followup_before_end_date;
