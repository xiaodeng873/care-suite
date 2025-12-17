/*
  # Add missing columns to health_assessments table

  1. New Columns
    - `smoking_years_quit` (text) - 戒煙年數
    - `smoking_quantity` (text) - 每天吸煙支數
    - `drinking_years_quit` (text) - 戒酒年數
    - `drinking_quantity` (text) - 每天飲酒罐數/杯數
    - `communication_other` (text) - 其他溝通情況說明
    - `consciousness_other` (text) - 其他意識認知情況說明
    - `emotional_other` (text) - 其他情緒表現說明

  2. Changes
    - Add missing columns that are used in the application but don't exist in the database
    - All new columns are nullable to maintain compatibility with existing data
*/

-- Add missing columns to health_assessments table
DO $$
BEGIN
  -- Add smoking_years_quit column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'smoking_years_quit'
  ) THEN
    ALTER TABLE health_assessments ADD COLUMN smoking_years_quit text;
  END IF;

  -- Add smoking_quantity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'smoking_quantity'
  ) THEN
    ALTER TABLE health_assessments ADD COLUMN smoking_quantity text;
  END IF;

  -- Add drinking_years_quit column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'drinking_years_quit'
  ) THEN
    ALTER TABLE health_assessments ADD COLUMN drinking_years_quit text;
  END IF;

  -- Add drinking_quantity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'drinking_quantity'
  ) THEN
    ALTER TABLE health_assessments ADD COLUMN drinking_quantity text;
  END IF;

  -- Add communication_other column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'communication_other'
  ) THEN
    ALTER TABLE health_assessments ADD COLUMN communication_other text;
  END IF;

  -- Add consciousness_other column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'consciousness_other'
  ) THEN
    ALTER TABLE health_assessments ADD COLUMN consciousness_other text;
  END IF;

  -- Add emotional_other column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'emotional_other'
  ) THEN
    ALTER TABLE health_assessments ADD COLUMN emotional_other text;
  END IF;
END $$;