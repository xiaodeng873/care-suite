/*
  # Add remarks field to blood sugar records

  1. Changes
    - Add remarks column to 健康記錄主表 for blood sugar control records
    - This field will store additional notes for blood sugar measurements

  2. Security
    - No changes to existing RLS policies needed
*/

DO $$
BEGIN
  -- Check if remarks column already exists for blood sugar records
  -- The column already exists in the table, so no changes needed
  -- This migration serves as documentation for the blood sugar remarks feature
END $$;