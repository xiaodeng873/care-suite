/*
  # Add medication_source column to medication_prescriptions table

  1. Schema Changes
    - Add `medication_source` column to `medication_prescriptions` table
    - Column type: text (to store hospital/clinic names)
    - Column is required (NOT NULL)
    - Add default value for existing records

  2. Notes
    - This column stores the source of the medication prescription (hospital, clinic, etc.)
    - Existing records will get a default value to maintain data integrity
*/

-- Add medication_source column to medication_prescriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medication_prescriptions' AND column_name = 'medication_source'
  ) THEN
    ALTER TABLE medication_prescriptions 
    ADD COLUMN medication_source text NOT NULL DEFAULT '未指定來源';
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_medication_source 
ON medication_prescriptions USING btree (medication_source);