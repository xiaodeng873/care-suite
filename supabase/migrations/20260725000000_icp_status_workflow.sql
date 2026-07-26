-- 個人照顧計劃 (ICP) 四態狀態機與工作流程
-- 創建日期: 2026-07-25

-- 1. 新增成效檢討日期欄位
ALTER TABLE care_plans
ADD COLUMN IF NOT EXISTS review_date DATE;

COMMENT ON COLUMN care_plans.review_date IS '成效檢討完成日期（檢討日期）';

-- 2. 修改自動計算復檢到期日的觸發器
-- 首月計劃：plan_date + 1 天（配合 plan_date = 入住日 + 29）
-- 半年計劃：plan_date + 6 個月
-- 年度計劃：plan_date + 12 個月
CREATE OR REPLACE FUNCTION calculate_review_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan_type = '首月計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '1 day';
  ELSIF NEW.plan_type = '半年計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '6 months';
  ELSIF NEW.plan_type = '年度計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '12 months';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 資料遷移：把舊狀態轉換為新四態
-- 先建立可寫入舊值的臨時約束避開檢查（如有）
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'care_plans'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE care_plans DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- 更新舊資料
UPDATE care_plans
SET status = CASE
  WHEN status = 'archived' THEN
    CASE
      WHEN reviewed_at IS NOT NULL THEN '已完成'
      ELSE '待檢討'
    END
  WHEN status = 'active' THEN
    CASE
      WHEN review_due_date IS NOT NULL AND review_due_date >= CURRENT_DATE THEN '生效中'
      WHEN review_due_date IS NOT NULL AND review_due_date < CURRENT_DATE THEN
        CASE
          WHEN reviewed_at IS NOT NULL THEN '已完成'
          ELSE '待檢討'
        END
      ELSE '生效中'
    END
  ELSE status
END;

-- 4. 新增新的狀態約束
ALTER TABLE care_plans
ADD CONSTRAINT care_plans_status_check
CHECK (status IN ('生效中', '待檢討', '已完成', '待生效'));

-- 5. 調整預設值（若存在）
ALTER TABLE care_plans
ALTER COLUMN status SET DEFAULT '生效中';

-- 6. 索引
CREATE INDEX IF NOT EXISTS idx_care_plans_review_date ON care_plans(review_date);
CREATE INDEX IF NOT EXISTS idx_care_plans_status_plan_date ON care_plans(status, plan_date DESC);

-- 7. 註解
COMMENT ON COLUMN care_plans.status IS '生效中/待檢討/已完成/待生效';
