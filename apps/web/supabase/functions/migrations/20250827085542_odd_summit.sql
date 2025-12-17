/*
  # 新增藥物自存同意書任務類型

  1. 枚舉更新
    - 在 `health_task_type` 枚舉中新增 '藥物自存同意書' 值
    - 此任務類型與約束物品同意書具有相同的邏輯和頻率

  2. 說明
    - 藥物自存同意書是文件任務，需要定期簽署
    - 預設頻率為每6個月一次
    - 使用與約束物品同意書相同的處理邏輯
*/

-- 新增 '藥物自存同意書' 到 health_task_type 枚舉
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '藥物自存同意書';