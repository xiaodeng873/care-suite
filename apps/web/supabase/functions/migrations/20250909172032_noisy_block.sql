/*
  # Add dosage_unit column to new_medication_prescriptions table

  1. New Columns
    - `dosage_unit` (text) - 藥物劑量單位，如：粒、片、毫升等

  2. Index
    - Add index on dosage_unit for better query performance

  3. Data Migration
    - Set default unit based on existing dosage_form where possible
*/

-- Add dosage_unit column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'dosage_unit'
  ) THEN
    ALTER TABLE new_medication_prescriptions ADD COLUMN dosage_unit text;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_new_medication_prescriptions_dosage_unit 
ON new_medication_prescriptions(dosage_unit);

-- Update existing records with default units based on dosage_form
UPDATE new_medication_prescriptions 
SET dosage_unit = CASE 
  WHEN dosage_form = '片劑' THEN '片'
  WHEN dosage_form = '膠囊' THEN '粒'
  WHEN dosage_form = '藥水' THEN 'ml'
  WHEN dosage_form = '注射劑' THEN 'ml'
  WHEN dosage_form = '外用藥膏' THEN 'g'
  WHEN dosage_form = '滴劑' THEN '滴'
  ELSE '粒'
END
WHERE dosage_unit IS NULL;