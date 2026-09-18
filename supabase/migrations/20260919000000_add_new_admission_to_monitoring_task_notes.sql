/*
  # 監測任務備註新增「新入住」枚舉值

  1. 變更
    - monitoring_task_notes 枚舉類型新增「新入住」
    - 對應前端 MonitoringTaskNotes 類型（apps/web/src/lib/database.tsx）

  2. 說明
    - 「新入住」用於標記新入院院友的監測任務
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '新入住'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'monitoring_task_notes')
  ) THEN
    ALTER TYPE monitoring_task_notes ADD VALUE '新入住';
  END IF;
END $$;
