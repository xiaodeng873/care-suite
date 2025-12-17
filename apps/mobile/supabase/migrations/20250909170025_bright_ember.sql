/*
  # Add daily_frequency column to new_medication_prescriptions table

  1. Changes
    - Add `daily_frequency` column to `new_medication_prescriptions` table
    - Set default value to 1 for existing records
    - Add index for better query performance

  2. Notes
    - This column stores the maximum number of times a medication can be taken per day
    - For PRN medications, this represents the maximum allowed frequency
    - For regular medications, this should match the number of time slots
*/

-- Add daily_frequency column to new_medication_prescriptions table
ALTER TABLE new_medication_prescriptions 
ADD COLUMN IF NOT EXISTS daily_frequency INTEGER DEFAULT 1;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_new_medication_prescriptions_daily_frequency 
ON new_medication_prescriptions(daily_frequency);

-- Update existing records to set daily_frequency based on medication_time_slots
UPDATE new_medication_prescriptions 
SET daily_frequency = CASE 
  WHEN jsonb_array_length(medication_time_slots) > 0 
  THEN jsonb_array_length(medication_time_slots)
  ELSE 1
END
WHERE daily_frequency IS NULL;