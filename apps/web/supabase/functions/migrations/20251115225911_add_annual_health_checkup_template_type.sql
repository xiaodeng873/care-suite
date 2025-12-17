/*
  # 添加年度體檢範本類型

  1. 更新 template_type 枚舉
    - 添加 'annual-health-checkup' 值到 template_type 枚舉
  
  2. 說明
    - 此迁移添加了對「安老院住客體格檢驗報告書」範本類型的支持
    - 修復了上傳年度體檢範本時的 400 錯誤
*/

-- 添加 'annual-health-checkup' 值到 template_type 枚舉
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'annual-health-checkup';
