/*
  # Fix ID number field length constraint

  1. Schema Changes
    - Increase the length of `身份證號碼` column from VARCHAR(10) to VARCHAR(20)
    - This will accommodate longer identification numbers

  2. Notes
    - This change is backward compatible as it only increases the allowed length
    - Existing data will remain unchanged
*/

-- Increase the length of the ID number field to accommodate longer identification numbers
ALTER TABLE 院友主表 
ALTER COLUMN 身份證號碼 TYPE character varying(20);