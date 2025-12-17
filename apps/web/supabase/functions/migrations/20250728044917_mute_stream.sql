/*
  # Add follow-up-list to template_type enum

  1. Changes
    - Add 'follow-up-list' to the template_type enum
    - This allows storing follow-up list templates in the templates_metadata table

  2. Security
    - No changes to existing RLS policies needed
*/

-- Add 'follow-up-list' to the template_type enum
ALTER TYPE template_type ADD VALUE 'follow-up-list';