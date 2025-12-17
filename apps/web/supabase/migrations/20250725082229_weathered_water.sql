/*
  # Update meal guidance system

  1. Changes
    - Add 雞蛋 to special_diet_type enum
    - Add egg_quantity column for egg count
    - Add remarks column for additional notes
    - Add unique constraint to prevent duplicate guidance per patient

  2. Security
    - Maintain existing RLS policies
*/

-- Add 雞蛋 to special_diet_type enum
ALTER TYPE special_diet_type ADD VALUE '雞蛋';

-- Add new columns to meal_guidance table
DO $$
BEGIN
  -- Add egg_quantity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_guidance' AND column_name = 'egg_quantity'
  ) THEN
    ALTER TABLE meal_guidance ADD COLUMN egg_quantity integer;
  END IF;

  -- Add remarks column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_guidance' AND column_name = 'remarks'
  ) THEN
    ALTER TABLE meal_guidance ADD COLUMN remarks text;
  END IF;
END $$;

-- Add unique constraint to prevent duplicate guidance per patient
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'meal_guidance' AND constraint_name = 'meal_guidance_patient_id_unique'
  ) THEN
    ALTER TABLE meal_guidance ADD CONSTRAINT meal_guidance_patient_id_unique UNIQUE (patient_id);
  END IF;
END $$;

-- Add index for egg_quantity
CREATE INDEX IF NOT EXISTS idx_meal_guidance_egg_quantity ON meal_guidance (egg_quantity);

-- Add index for remarks
CREATE INDEX IF NOT EXISTS idx_meal_guidance_remarks ON meal_guidance USING gin (to_tsvector('english', remarks));