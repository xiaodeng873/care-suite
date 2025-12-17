/*
  # Add missing template types to template_type enum

  1. Enum Updates
    - Add 'vital-signs' to template_type enum
    - Add 'blood-sugar' to template_type enum  
    - Add 'weight-control' to template_type enum
    - Add 'follow-up-list' to template_type enum
    - Add 'restraint-observation' to template_type enum

  2. Purpose
    - Enable uploading and managing templates for health records
    - Support restraint observation form templates
    - Support follow-up appointment list templates
*/

-- Add missing values to template_type enum
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'vital-signs';
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'blood-sugar';
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'weight-control';
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'follow-up-list';
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'restraint-observation';