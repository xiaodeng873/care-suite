/*
  # Create prescription workflow records table

  1. New Tables
    - `prescription_workflow_records`
      - `id` (uuid, primary key)
      - `prescription_id` (uuid, foreign key to new_medication_prescriptions)
      - `patient_id` (integer, foreign key to 院友主表)
      - `scheduled_date` (date)
      - `scheduled_time` (time without time zone)
      - `meal_timing` (text)
      - `preparation_status` (text, default 'pending')
      - `verification_status` (text, default 'pending')
      - `dispensing_status` (text, default 'pending')
      - `preparation_staff` (text)
      - `verification_staff` (text)
      - `dispensing_staff` (text)
      - `preparation_time` (timestamptz)
      - `verification_time` (timestamptz)
      - `dispensing_time` (timestamptz)
      - `dispensing_failure_reason` (text)
      - `custom_failure_reason` (text)
      - `inspection_check_result` (jsonb)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `prescription_workflow_records` table
    - Add policies for authenticated users to manage workflow records

  3. Indexes
    - Add indexes for common query patterns
*/

-- Create the prescription_workflow_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS prescription_workflow_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL,
  patient_id integer NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time without time zone NOT NULL,
  meal_timing text,
  preparation_status text DEFAULT 'pending' NOT NULL,
  verification_status text DEFAULT 'pending' NOT NULL,
  dispensing_status text DEFAULT 'pending' NOT NULL,
  preparation_staff text,
  verification_staff text,
  dispensing_staff text,
  preparation_time timestamptz,
  verification_time timestamptz,
  dispensing_time timestamptz,
  dispensing_failure_reason text,
  custom_failure_reason text,
  inspection_check_result jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'prescription_workflow_records_patient_id_fkey'
  ) THEN
    ALTER TABLE prescription_workflow_records 
    ADD CONSTRAINT prescription_workflow_records_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES "院友主表"("院友id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'prescription_workflow_records_prescription_id_fkey'
  ) THEN
    ALTER TABLE prescription_workflow_records 
    ADD CONSTRAINT prescription_workflow_records_prescription_id_fkey 
    FOREIGN KEY (prescription_id) REFERENCES new_medication_prescriptions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraints for status fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'prescription_workflow_records_preparation_status_check'
  ) THEN
    ALTER TABLE prescription_workflow_records 
    ADD CONSTRAINT prescription_workflow_records_preparation_status_check 
    CHECK (preparation_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'prescription_workflow_records_verification_status_check'
  ) THEN
    ALTER TABLE prescription_workflow_records 
    ADD CONSTRAINT prescription_workflow_records_verification_status_check 
    CHECK (verification_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'prescription_workflow_records_dispensing_status_check'
  ) THEN
    ALTER TABLE prescription_workflow_records 
    ADD CONSTRAINT prescription_workflow_records_dispensing_status_check 
    CHECK (dispensing_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prescription_workflow_records_patient_id 
ON prescription_workflow_records (patient_id);

CREATE INDEX IF NOT EXISTS idx_prescription_workflow_records_prescription_id 
ON prescription_workflow_records (prescription_id);

CREATE INDEX IF NOT EXISTS idx_prescription_workflow_records_scheduled_date 
ON prescription_workflow_records (scheduled_date);

CREATE INDEX IF NOT EXISTS idx_prescription_workflow_records_preparation_status 
ON prescription_workflow_records (preparation_status);

CREATE INDEX IF NOT EXISTS idx_prescription_workflow_records_verification_status 
ON prescription_workflow_records (verification_status);

CREATE INDEX IF NOT EXISTS idx_prescription_workflow_records_dispensing_status 
ON prescription_workflow_records (dispensing_status);

-- Enable Row Level Security
ALTER TABLE prescription_workflow_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY IF NOT EXISTS "允許已認證用戶管理工作流程記錄"
  ON prescription_workflow_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_prescription_workflow_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_prescription_workflow_records_updated_at ON prescription_workflow_records;
CREATE TRIGGER update_prescription_workflow_records_updated_at
  BEFORE UPDATE ON prescription_workflow_records
  FOR EACH ROW
  EXECUTE FUNCTION update_prescription_workflow_records_updated_at();