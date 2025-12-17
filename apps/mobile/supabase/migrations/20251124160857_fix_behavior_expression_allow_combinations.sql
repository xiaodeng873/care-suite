/*
  # 修復行為表現欄位約束以支持多選組合

  1. 問題
    - behavior_expression 欄位目前只允許單一值
    - UI 支持多選，但資料庫約束不允許組合值（如 "遊走、逃跑"）

  2. 修復
    - 移除舊的 CHECK 約束
    - 改為無約束，允許任何文字組合
    - 前端會將多選項目用「、」連接
*/

-- 移除舊的約束
ALTER TABLE health_assessments 
DROP CONSTRAINT IF EXISTS health_assessments_behavior_expression_check;

-- 不添加新約束，允許任意文字
-- 前端會負責確保只存入有效的組合
