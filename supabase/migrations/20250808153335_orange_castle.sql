/*
  # Add restraint-observation to template_type enum

  1. Enum Updates
    - Add 'restraint-observation' value to template_type enum
    - This enables uploading and managing restraint observation form templates

  2. Purpose
    - Allows users to upload custom restraint observation form templates
    - Supports the export functionality for restraint observation forms
    - Completes the restraint management template system
*/

-- Add the new enum value to template_type
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'restraint-observation';