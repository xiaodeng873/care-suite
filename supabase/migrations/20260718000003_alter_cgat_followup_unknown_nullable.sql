/*
  將 cgat_records.cgat_visit_unknown 改為可為 NULL，並允許未設定時為 NULL。
  此 migration 用於已套用 20260718000002_add_cgat_followup_unknown.sql 的環境。
*/

ALTER TABLE cgat_records
  ALTER COLUMN cgat_visit_unknown DROP NOT NULL;

ALTER TABLE cgat_records
  ALTER COLUMN cgat_visit_unknown SET DEFAULT NULL;
