-- 新增照顧計劃相關欄位
-- 創建日期: 2026-01-05

-- ============================================
-- 1. 為 care_plan_problems 表新增成效檢討詳情欄位
-- ============================================
ALTER TABLE care_plan_problems 
ADD COLUMN IF NOT EXISTS outcome_review_details TEXT;

COMMENT ON COLUMN care_plan_problems.outcome_review_details IS '成效檢討詳情（當選擇部分滿意或需要持續改善時填寫）';

-- ============================================
-- 2. 為 care_plans 表新增個案會議相關欄位
-- ============================================
-- 邀請家人及院友參與個人護理計劃過程，徵詢意見
ALTER TABLE care_plans 
ADD COLUMN IF NOT EXISTS family_participated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN care_plans.family_participated IS '邀請家人及院友參與個人護理計劃過程，徵詢意見';

-- 負責職員
ALTER TABLE care_plans 
ADD COLUMN IF NOT EXISTS responsible_staff TEXT;

COMMENT ON COLUMN care_plans.responsible_staff IS '負責職員';

-- 特別護理需求/其他專業意見(如有)
ALTER TABLE care_plans 
ADD COLUMN IF NOT EXISTS special_care_needs TEXT;

COMMENT ON COLUMN care_plans.special_care_needs IS '特別護理需求/其他專業意見(如有)';

-- ============================================
-- 完成
-- ============================================
