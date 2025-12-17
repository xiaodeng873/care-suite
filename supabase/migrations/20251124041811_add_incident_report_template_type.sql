/*
  # 添加意外事件報告範本類型

  1. 變更
    - 在 template_type enum 中添加 'incident-report' 值
    
  2. 說明
    - 此值用於意外事件報告的 Word 範本上傳功能
    - 允許系統識別和管理意外事件報告範本
*/

-- 添加 incident-report 到 template_type enum
ALTER TYPE template_type ADD VALUE IF NOT EXISTS 'incident-report';
