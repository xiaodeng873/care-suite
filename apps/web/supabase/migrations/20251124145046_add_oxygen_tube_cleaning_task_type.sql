/*
  # 添加氧氣喉管清洗/更換任務類型

  1. 變更
    - 新增「氧氣喉管清洗/更換」至 health_task_type 枚舉類型

  2. 說明
    - 氧氣喉管清洗/更換為護理任務
    - 需要定期執行以確保氧氣治療的安全性和有效性
*/

-- 添加「氧氣喉管清洗/更換」到 health_task_type 枚舉類型
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '氧氣喉管清洗/更換'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'health_task_type')
  ) THEN
    ALTER TYPE health_task_type ADD VALUE '氧氣喉管清洗/更換';
  END IF;
END $$;

-- 更新表註釋
COMMENT ON TYPE health_task_type IS '健康任務類型：生命表徵、血糖控制、體重控制、約束物品同意書、年度體檢、尿導管更換、鼻胃飼管更換、傷口換症、藥物自存同意書、晚晴計劃、氧氣喉管清洗/更換';
