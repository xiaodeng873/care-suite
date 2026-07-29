/*
  # 在 health_task_type 枚舉新增「預設醫療指示」

  1. 變更
    - 新增「預設醫療指示」到 health_task_type 枚舉

  2. 說明
    - 因 PostgreSQL 不支援直接重新命名 enum 值，故先新增新值，再由另一 migration 搬移資料
    - 舊 enum 值 '晚晴計劃' 會保留在枚舉中但不再使用
*/

-- 新增「預設醫療指示」到 health_task_type 枚舉
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '預設醫療指示'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'health_task_type')
  ) THEN
    ALTER TYPE health_task_type ADD VALUE '預設醫療指示';
  END IF;
END $$;
