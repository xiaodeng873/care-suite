-- ============================================================
-- Migration: 將 '呼吸頻率' 全面改名為 '呼吸'
-- 2026-06-28
--
-- 安全性：使用 IF EXISTS guard，可在任何 DB 狀態執行：
--   · 若 20260627000001/0002 尚未套用 → 此 migration 的 RENAME/UPDATE 為 no-op
--   · 若已套用 → 正確執行 rename
-- ============================================================

-- ─── Step 1: 重命名舊表欄位（若存在）───────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = '健康記錄主表'
      AND  column_name  = '呼吸頻率'
  ) THEN
    ALTER TABLE 健康記錄主表 RENAME COLUMN 呼吸頻率 TO 呼吸;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'deleted_health_records'
      AND  column_name  = '呼吸頻率'
  ) THEN
    ALTER TABLE deleted_health_records RENAME COLUMN 呼吸頻率 TO 呼吸;
  END IF;
END $$;

-- ─── Step 2: 更新 enum 值（若舊值存在）──────────────────────
-- PostgreSQL 10+ 支援 ALTER TYPE ... RENAME VALUE
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN   pg_type t ON e.enumtypid = t.oid
    WHERE  t.typname   = 'health_task_type'
      AND  e.enumlabel = '呼吸頻率'
  ) THEN
    ALTER TYPE health_task_type RENAME VALUE '呼吸頻率' TO '呼吸';
  END IF;
END $$;

-- ─── Step 3: 更新 健康監測記錄 CHECK constraint ───────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_name       = '健康監測記錄'
      AND  constraint_name  = '監測類型_限定'
      AND  constraint_type  = 'CHECK'
  ) THEN
    ALTER TABLE 健康監測記錄 DROP CONSTRAINT 監測類型_限定;
    ALTER TABLE 健康監測記錄
      ADD CONSTRAINT 監測類型_限定 CHECK (
        監測類型 IN ('血壓','脈搏','體溫','血含氧量','呼吸','血糖值','體重')
      );
  END IF;
END $$;

-- ─── Step 4: 更新現有資料列 ──────────────────────────────────
UPDATE 健康監測記錄
SET    監測類型 = '呼吸'::health_task_type
WHERE  監測類型::text = '呼吸頻率';

UPDATE patient_health_tasks
SET    health_record_type = '呼吸'::health_task_type
WHERE  health_record_type::text = '呼吸頻率';
