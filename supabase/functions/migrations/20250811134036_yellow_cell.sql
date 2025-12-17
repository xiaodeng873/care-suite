/*
  # Add new template types to enum

  1. Changes
    - Add 'diaper-change-record' to template_type enum
    - Add 'personal-hygiene-record' to template_type enum  
    - Add 'admission-layout' to template_type enum

  2. Security
    - No changes to existing RLS policies
    - Enum values are additive and don't affect existing data
*/

-- Add new template types to the existing enum
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'diaper-change-record';
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'personal-hygiene-record';
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'admission-layout';