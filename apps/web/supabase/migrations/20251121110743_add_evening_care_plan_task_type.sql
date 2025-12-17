/*
  # 添加晚晴計劃任務類型

  1. 變更
    - 新增「晚晴計劃」至 health_task_type 枚舉類型
    - 更新 patient_health_tasks 表的檢查約束

  2. 說明
    - 晚晴計劃為年度醫生簽署文件任務
    - 預設頻率為每年一次
    - 到期前一個月會在主面板提醒
*/

-- 添加「晚晴計劃」到 health_task_type 枚舉類型
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '晚晴計劃'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'health_task_type')
  ) THEN
    ALTER TYPE health_task_type ADD VALUE '晚晴計劃';
  END IF;
END $$;

-- 更新表註釋
COMMENT ON TYPE health_task_type IS '健康任務類型：生命表徵、血糖控制、體重控制、約束物品同意書、年度體檢、尿導管更換、鼻胃飼管更換、傷口換症、藥物自存同意書、晚晴計劃';
