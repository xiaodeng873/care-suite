/*
  # Restructure Hospital Outreach Records

  1. New Tables
    - `doctor_visit_schedule`
      - `id` (uuid, primary key)
      - `visit_date` (date)
      - `doctor_name` (text)
      - `specialty` (text)
      - `available_slots` (integer)
      - `booked_slots` (integer)
      - `notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Schema Updates
    - Add `medication_sources` JSONB column to `hospital_outreach_records`
    - Each medication source contains: bag_date, prescription_weeks, end_date, source
    - Migrate existing single medication source data to array format

  3. Security
    - Enable RLS on `doctor_visit_schedule` table
    - Add policies for authenticated users to manage doctor visit schedules
*/

-- Create doctor_visit_schedule table if it doesn't exist
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

-- Add indexes for doctor_visit_schedule
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_visit_date ON doctor_visit_schedule (visit_date);
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_doctor_name ON doctor_visit_schedule (doctor_name);
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_specialty ON doctor_visit_schedule (specialty);
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_created_at ON doctor_visit_schedule (created_at);

-- Enable RLS on doctor_visit_schedule
ALTER TABLE doctor_visit_schedule ENABLE ROW LEVEL SECURITY;

-- Create policies for doctor_visit_schedule (with IF NOT EXISTS check)
DO $$
BEGIN
  -- Check and create SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'doctor_visit_schedule' 
    AND policyname = '允許已認證用戶讀取醫生到診排程'
  ) THEN
    CREATE POLICY "允許已認證用戶讀取醫生到診排程"
      ON doctor_visit_schedule
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Check and create INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'doctor_visit_schedule' 
    AND policyname = '允許已認證用戶新增醫生到診排程'
  ) THEN
    CREATE POLICY "允許已認證用戶新增醫生到診排程"
      ON doctor_visit_schedule
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Check and create UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'doctor_visit_schedule' 
    AND policyname = '允許已認證用戶更新醫生到診排程'
  ) THEN
    CREATE POLICY "允許已認證用戶更新醫生到診排程"
      ON doctor_visit_schedule
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Check and create DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'doctor_visit_schedule' 
    AND policyname = '允許已認證用戶刪除醫生到診排程'
  ) THEN
    CREATE POLICY "允許已認證用戶刪除醫生到診排程"
      ON doctor_visit_schedule
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Add medication_sources column to hospital_outreach_records if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospital_outreach_records' AND column_name = 'medication_sources'
  ) THEN
    ALTER TABLE hospital_outreach_records ADD COLUMN medication_sources jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create index for medication_sources
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_medication_sources 
ON hospital_outreach_records USING gin (medication_sources);

-- Migrate existing data to new structure (only if medication_sources is empty)
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

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_doctor_visit_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_doctor_visit_schedule_updated_at'
  ) THEN
    CREATE TRIGGER update_doctor_visit_schedule_updated_at
      BEFORE UPDATE ON doctor_visit_schedule
      FOR EACH ROW
      EXECUTE FUNCTION update_doctor_visit_schedule_updated_at();
  END IF;
END $$;