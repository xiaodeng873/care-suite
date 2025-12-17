/*
  # Add medication_source column to medication_prescriptions table

  1. New Columns
    - `medication_source` (text, required)
      - Source of the medication prescription (hospital, clinic, etc.)
      - Required field with default value for existing records
  
  2. Indexes
    - Add index on `medication_source` for better query performance
  
  3. Data Migration
    - Set default value for existing records to maintain data integrity
*/

-- Add the medication_source column as NOT NULL with a default value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medication_prescriptions' AND column_name = 'medication_source'
  ) THEN
    -- First add the column as nullable
    ALTER TABLE medication_prescriptions ADD COLUMN medication_source text;
    
    -- Update existing records with a default value
    UPDATE medication_prescriptions 
    SET medication_source = '未指定來源' 
    WHERE medication_source IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE medication_prescriptions 
    ALTER COLUMN medication_source SET NOT NULL;
    
    -- Set the default for future records
    ALTER TABLE medication_prescriptions 
    ALTER COLUMN medication_source SET DEFAULT '未指定來源';
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_medication_prescriptions_medication_source 
ON medication_prescriptions(medication_source);