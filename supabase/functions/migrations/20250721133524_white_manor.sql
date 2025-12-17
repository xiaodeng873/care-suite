/*
  # Update health task types

  1. Enum Updates
    - Add new task types: '約束物品同意書' and '年度體檢'
    - These are document tasks vs monitoring tasks

  2. Changes
    - Extend health_task_type enum with new values
*/

-- Add new values to health_task_type enum
ALTER TYPE health_task_type ADD VALUE '約束物品同意書';
ALTER TYPE health_task_type ADD VALUE '年度體檢';