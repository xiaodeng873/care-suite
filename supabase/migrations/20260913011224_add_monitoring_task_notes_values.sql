/*
  # 擴充 monitoring_task_notes 枚舉：新增三個備註標簽

  1. 變更
    - `monitoring_task_notes` 枚舉新增「藥物調節」「異常監察」「最近出院」

  2. 說明
    - 前端 TaskModal 備註下拉已提供此三個選項（原「社康」由三者取代），
      但資料庫枚舉未同步，INSERT 時報 22P02 導致無法新增任務
    - 參考 apps/web/.bolt/supabase_discarded_migrations/20250722173959_falling_lodge.sql
      的枚舉原始定義
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '藥物調節'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'monitoring_task_notes')
  ) THEN
    ALTER TYPE monitoring_task_notes ADD VALUE '藥物調節';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '異常監察'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'monitoring_task_notes')
  ) THEN
    ALTER TYPE monitoring_task_notes ADD VALUE '異常監察';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '最近出院'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'monitoring_task_notes')
  ) THEN
    ALTER TYPE monitoring_task_notes ADD VALUE '最近出院';
  END IF;
END $$;
