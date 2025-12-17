/*
  # 新增健康記錄範本類型到 template_type 枚舉

  1. 枚舉更新
    - 新增 'vital-signs' (生命表徵觀察記錄表)
    - 新增 'blood-sugar' (血糖測試記錄表)  
    - 新增 'weight-control' (體重記錄表)

  2. 說明
    - 擴展現有的 template_type 枚舉以支援新的健康記錄範本類型
    - 確保應用程式可以正確儲存這些範本類型的元數據
*/

-- 新增健康記錄相關的範本類型到枚舉
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'vital-signs';
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'blood-sugar';
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'weight-control';