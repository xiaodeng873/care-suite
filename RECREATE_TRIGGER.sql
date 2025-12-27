-- 重新創建復檢到期日計算觸發器
-- 執行日期: 2025-12-26

-- 先刪除舊的（如果存在）
DROP TRIGGER IF EXISTS trigger_calculate_review_due_date ON care_plans;
DROP FUNCTION IF EXISTS calculate_review_due_date();

-- 重新創建函數
CREATE OR REPLACE FUNCTION calculate_review_due_date()
RETURNS TRIGGER AS $$
BEGIN
  -- 根據計劃類型計算復檢到期日
  IF NEW.plan_type = '首月計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '6 months';
  ELSIF NEW.plan_type = '半年計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '6 months';
  ELSIF NEW.plan_type = '年度計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '12 months';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 重新創建觸發器
CREATE TRIGGER trigger_calculate_review_due_date
  BEFORE INSERT OR UPDATE OF plan_type, plan_date ON care_plans
  FOR EACH ROW
  EXECUTE FUNCTION calculate_review_due_date();

-- 測試：更新所有現有記錄以觸發計算
UPDATE care_plans
SET updated_at = NOW();

-- 驗證結果
SELECT 
  id,
  plan_type,
  plan_date::date as plan_date,
  review_due_date::date as review_due_date,
  CASE
    WHEN plan_type = '首月計劃' THEN (plan_date + INTERVAL '6 months')::date
    WHEN plan_type = '半年計劃' THEN (plan_date + INTERVAL '6 months')::date
    WHEN plan_type = '年度計劃' THEN (plan_date + INTERVAL '12 months')::date
  END as expected_date,
  CASE
    WHEN review_due_date = CASE
      WHEN plan_type = '首月計劃' THEN plan_date + INTERVAL '6 months'
      WHEN plan_type = '半年計劃' THEN plan_date + INTERVAL '6 months'
      WHEN plan_type = '年度計劃' THEN plan_date + INTERVAL '12 months'
    END THEN '✅ 正確'
    ELSE '❌ 錯誤'
  END as status
FROM care_plans
ORDER BY plan_date DESC;
