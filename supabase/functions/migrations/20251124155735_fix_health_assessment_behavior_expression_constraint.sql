/*
  # 修復健康評估行為表現欄位約束

  1. 問題
    - behavior_expression 欄位的 CHECK 約束過於嚴格
    - 只允許特定的單一值,不允許 NULL 或其他情況

  2. 修復
    - 移除舊的 CHECK 約束
    - 允許 NULL 值和空字串
    - 保持原有的有效值選項
*/

-- 移除舊的約束
ALTER TABLE health_assessments 
DROP CONSTRAINT IF EXISTS health_assessments_behavior_expression_check;

-- 添加新的約束,允許 NULL
ALTER TABLE health_assessments
ADD CONSTRAINT health_assessments_behavior_expression_check 
CHECK (
  behavior_expression IS NULL OR 
  behavior_expression = ANY (ARRAY['遊走'::text, '逃跑'::text, '暴力'::text, '偷竊'::text, '夢遊'::text, '囤積'::text, ''::text])
);
