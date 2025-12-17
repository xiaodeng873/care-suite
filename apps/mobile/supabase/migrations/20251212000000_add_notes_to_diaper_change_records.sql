-- Add notes column to diaper_change_records to store status/remarks
ALTER TABLE diaper_change_records
  ADD COLUMN IF NOT EXISTS notes text;
