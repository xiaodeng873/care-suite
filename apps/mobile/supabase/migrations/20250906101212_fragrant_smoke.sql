/*
  # Add inspection_rules column to new_medication_prescriptions table

  1. Changes
    - Add `inspection_rules` column to `new_medication_prescriptions` table
    - Column type: JSONB to store array of inspection rule objects
    - Default value: empty array '[]'
    - Add index for better query performance

  2. Security
    - No changes to existing RLS policies needed
*/

-- Add inspection_rules column to new_medication_prescriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'inspection_rules'
  ) THEN
    ALTER TABLE new_medication_prescriptions 
    ADD COLUMN inspection_rules JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add index for inspection_rules column for better query performance
CREATE INDEX IF NOT EXISTS idx_new_medication_prescriptions_inspection_rules 
ON new_medication_prescriptions USING gin (inspection_rules);