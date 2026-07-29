/*
  # 將「晚晴計劃」任務記錄搬移至「預設醫療指示」

  1. 變更
    - 將 patient_health_tasks 表中所有 health_record_type = '晚晴計劃' 的記錄更新為 '預設醫療指示'
    - 更新 health_task_type 枚舉註釋
*/

-- 更新現有任務記錄
UPDATE patient_health_tasks
SET health_record_type = '預設醫療指示'
WHERE health_record_type::text = '晚晴計劃';

-- 更新表註釋
COMMENT ON TYPE health_task_type IS '健康任務類型：生命表徵、血糖控制、體重控制、約束物品同意書、年度體檢、導尿管更換、鼻胃飼管更換、傷口換症、藥物自存同意書、預設醫療指示、氧氣喉管清洗/更換';
