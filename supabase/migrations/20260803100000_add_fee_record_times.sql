ALTER TABLE patient_fee_records ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE patient_fee_records ADD COLUMN IF NOT EXISTS end_time text;
