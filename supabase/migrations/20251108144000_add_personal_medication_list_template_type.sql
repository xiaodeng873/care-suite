/*
  # Add personal-medication-list to template_type enum

  1. Changes
    - Add 'personal-medication-list' to template_type enum
    - This allows storing personal medication list templates in the templates_metadata table

  2. Security
    - No security changes needed, existing RLS policies apply
*/

-- Add 'personal-medication-list' to the template_type enum
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'personal-medication-list';
