/*
  # Create patient logs table

  1. New Tables
    - `patient_logs`
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key to 院友主表)
      - `log_date` (date)
      - `log_type` (enum: 日常護理, 文件簽署, 入院/出院, 入住/退住, 醫生到診, 意外事故, 覆診返藥, 其他)
      - `content` (text)
      - `recorder` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `patient_logs` table
    - Add policies for authenticated users to manage patient logs

  3. Changes
    - Add tube_type and tube_size columns to patient_health_tasks table for nursing tasks
    - Create log_type enum for patient logs
*/

-- Create log type enum
CREATE TYPE log_type_enum AS ENUM (
  '日常護理',
  '文件簽署', 
  '入院/出院',
  '入住/退住',
  '醫生到診',
  '意外事故',
  '覆診',
  '其他'
);

-- Create patient logs table
CREATE TABLE IF NOT EXISTS patient_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  log_date date NOT NULL,
  log_type log_type_enum NOT NULL,
  content text NOT NULL,
  recorder text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add tube columns to patient_health_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_health_tasks' AND column_name = 'tube_type'
  ) THEN
    ALTER TABLE patient_health_tasks ADD COLUMN tube_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_health_tasks' AND column_name = 'tube_size'
  ) THEN
    ALTER TABLE patient_health_tasks ADD COLUMN tube_size text;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE patient_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for patient_logs
CREATE POLICY "Allow authenticated users to read patient logs"
  ON patient_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert patient logs"
  ON patient_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update patient logs"
  ON patient_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete patient logs"
  ON patient_logs
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patient_logs_patient_id ON patient_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_logs_log_date ON patient_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_patient_logs_log_type ON patient_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_patient_logs_created_at ON patient_logs(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_patient_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_logs_updated_at
  BEFORE UPDATE ON patient_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_logs_updated_at();