/*
  # 約束物品評估 + 喉管護理：新增「已終止（不再續期）」狀態

  - patient_restraint_assessments.is_terminated boolean default false
  - patient_tube_care_records.is_terminated boolean default false

  終止後該列視為舊記錄、不再計入逾期/即將到期提醒，可用篩選器「已終止」檢視。
*/

ALTER TABLE patient_restraint_assessments
  ADD COLUMN IF NOT EXISTS is_terminated boolean NOT NULL DEFAULT false;

ALTER TABLE patient_tube_care_records
  ADD COLUMN IF NOT EXISTS is_terminated boolean NOT NULL DEFAULT false;
