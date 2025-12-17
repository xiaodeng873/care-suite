/*
  # Restructure Hospital Outreach Records

  1. Database Changes
    - Update `hospital_outreach_records` table to support multiple medication sources
    - Create `doctor_visit_schedule` table for managing future doctor visits
    - Remove single medication source fields and replace with JSONB array

  2. New Tables
    - `doctor_visit_schedule` table for managing doctor visit dates

  3. Schema Updates
    - Replace single medication source with array of medication sources
    - Each medication source contains: bag_date, prescription_weeks, end_date, source
*/

-- Create doctor visit schedule table
CREATE TABLE IF NOT EXISTS doctor_visit_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_date date NOT NULL,
  doctor_name text,
  specialty text,
  available_slots integer DEFAULT 10,
  booked_slots integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for doctor visit schedule
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_visit_date ON doctor_visit_schedule(visit_date);
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_doctor_name ON doctor_visit_schedule(doctor_name);
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_specialty ON doctor_visit_schedule(specialty);
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_created_at ON doctor_visit_schedule(created_at);

-- Enable RLS for doctor visit schedule
ALTER TABLE doctor_visit_schedule ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for doctor visit schedule
CREATE POLICY "允許已認證用戶讀取醫生到診排程"
  ON doctor_visit_schedule
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增醫生到診排程"
  ON doctor_visit_schedule
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新醫生到診排程"
  ON doctor_visit_schedule
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除醫生到診排程"
  ON doctor_visit_schedule
  FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_doctor_visit_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_doctor_visit_schedule_updated_at
  BEFORE UPDATE ON doctor_visit_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_doctor_visit_schedule_updated_at();

-- Update hospital_outreach_records table structure
-- Add new medication_sources column (JSONB array)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospital_outreach_records' AND column_name = 'medication_sources'
  ) THEN
    ALTER TABLE hospital_outreach_records ADD COLUMN medication_sources jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add index for medication_sources
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_medication_sources 
ON hospital_outreach_records USING gin (medication_sources);

-- Migrate existing data to new structure (if there are existing records)
UPDATE hospital_outreach_records 
SET medication_sources = jsonb_build_array(
  jsonb_build_object(
    'medication_bag_date', medication_bag_date,
    'prescription_weeks', prescription_weeks,
    'medication_end_date', medication_end_date,
    'outreach_medication_source', outreach_medication_source
  )
)
WHERE medication_sources = '[]'::jsonb 
  AND medication_bag_date IS NOT NULL;

-- Remove old single medication source columns (after data migration)
-- Note: We'll keep them for now to avoid data loss, but they can be removed later
-- ALTER TABLE hospital_outreach_records DROP COLUMN IF EXISTS medication_bag_date;
-- ALTER TABLE hospital_outreach_records DROP COLUMN IF EXISTS prescription_weeks;
-- ALTER TABLE hospital_outreach_records DROP COLUMN IF EXISTS medication_end_date;
-- ALTER TABLE hospital_outreach_records DROP COLUMN IF EXISTS outreach_medication_source;