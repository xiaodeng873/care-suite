-- Add notes column to diaper_change_records and position_change_records
-- This allows storing status notes (入院/渡假/外出) for these record types

-- Add notes column to diaper_change_records if it doesn't exist
ALTER TABLE diaper_change_records 
ADD COLUMN IF NOT EXISTS notes text;

-- Add notes column to position_change_records if it doesn't exist
ALTER TABLE position_change_records 
ADD COLUMN IF NOT EXISTS notes text;

-- Create indexes for better query performance when filtering by notes
CREATE INDEX IF NOT EXISTS idx_diaper_change_records_notes 
  ON diaper_change_records (notes) 
  WHERE notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_position_change_records_notes 
  ON position_change_records (notes) 
  WHERE notes IS NOT NULL;
