/*
  # Add nursing task types to health_task_type enum

  1. Enum Updates
    - Add '導尿管更換' (Urinary catheter replacement)
    - Add '鼻胃飼管更換' (Nasogastric tube replacement) 
    - Add '傷口換症' (Wound dressing change)

  2. Changes
    - Extends the existing health_task_type enum to include nursing care tasks
    - These additions support the expanded task management functionality in the application
*/

-- Add new values to the health_task_type enum
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '導取管更換';
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '鼻胃飼管更換';
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '傷口換症';