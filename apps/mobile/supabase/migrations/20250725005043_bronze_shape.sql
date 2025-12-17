/*
  # Add end_date and end_time columns to patient_health_tasks

  1. Changes
    - Add `end_date` column (date, nullable) to `patient_health_tasks` table
    - Add `end_time` column (time, nullable) to `patient_health_tasks` table
    - Add `is_recurring` column (boolean, default true) to `patient_health_tasks` table

  2. Security
    - No changes to RLS policies needed
*/

-- Add the missing columns to patient_health_tasks table
DO $$
BEGIN
  -- Add end_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_health_tasks' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE patient_health_tasks ADD COLUMN end_date date;
  END IF;

  -- Add end_time column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_health_tasks' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE patient_health_tasks ADD COLUMN end_time time;
  END IF;

  -- Add is_recurring column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_health_tasks' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE patient_health_tasks ADD COLUMN is_recurring boolean DEFAULT true;
  END IF;
END $$;