-- 修復個人照顧計劃的復檢到期日
-- 執行日期: 2025-12-26

-- 方法1：直接更新所有計劃的 review_due_date
UPDATE care_plans
SET review_due_date = CASE
  WHEN plan_type = '首月計劃' THEN plan_date + INTERVAL '6 months'
  WHEN plan_type = '半年計劃' THEN plan_date + INTERVAL '6 months'
  WHEN plan_type = '年度計劃' THEN plan_date + INTERVAL '12 months'
  ELSE plan_date
END
WHERE review_due_date IS NULL 
   OR review_due_date = plan_date  -- 修復錯誤的日期（復檢日與計劃日相同）
   OR review_due_date < plan_date; -- 修復錯誤的日期（復檢日早於計劃日）

-- 方法2：觸發更新，讓觸發器重新計算（如果觸發器存在）
-- 這會觸發 BEFORE UPDATE 觸發器
UPDATE care_plans
SET updated_at = NOW()
WHERE review_due_date IS NULL 
   OR review_due_date = plan_date
   OR review_due_date < plan_date;

-- 查詢結果驗證
SELECT 
  id,
  plan_type,
  plan_date,
  review_due_date,
  CASE
    WHEN plan_type = '首月計劃' THEN plan_date + INTERVAL '6 months'
    WHEN plan_type = '半年計劃' THEN plan_date + INTERVAL '6 months'
    WHEN plan_type = '年度計劃' THEN plan_date + INTERVAL '12 months'
  END as expected_review_date,
  CASE
    WHEN review_due_date = plan_date THEN '❌ 錯誤：復檢日等於計劃日'
    WHEN review_due_date < plan_date THEN '❌ 錯誤：復檢日早於計劃日'
    WHEN review_due_date IS NULL THEN '❌ 錯誤：復檢日為空'
    WHEN plan_type = '首月計劃' AND review_due_date = plan_date + INTERVAL '6 months' THEN '✅ 正確'
    WHEN plan_type = '半年計劃' AND review_due_date = plan_date + INTERVAL '6 months' THEN '✅ 正確'
    WHEN plan_type = '年度計劃' AND review_due_date = plan_date + INTERVAL '12 months' THEN '✅ 正確'
    ELSE '⚠️ 不符合規則'
  END as status
FROM care_plans
ORDER BY plan_date DESC;
