/*
  # 新增床位表範本類型

  1. 枚舉類型更新
    - 在 `template_type` 枚舉中新增 'bed-layout' 值
  
  2. 說明
    - 此更新允許在範本管理中上傳床位表類型的範本
    - 'bed-layout' 用於站點床位配置和院友分佈表
*/

-- 新增 'bed-layout' 到 template_type 枚舉
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'bed-layout';