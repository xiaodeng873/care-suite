-- 請在 Supabase SQL Editor 中執行此 SQL
-- 或使用 psql 連線執行

-- 新增個案會議相關欄位
ALTER TABLE care_plans 
ADD COLUMN IF NOT EXISTS case_conference_date DATE,
ADD COLUMN IF NOT EXISTS case_conference_professionals JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS family_contact_date DATE,
ADD COLUMN IF NOT EXISTS family_member_name TEXT;

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_care_plans_case_conference_date 
ON care_plans(case_conference_date);

-- 更新專業類別約束以包含「社工」
ALTER TABLE problem_library DROP CONSTRAINT IF EXISTS problem_library_category_check;
ALTER TABLE problem_library 
ADD CONSTRAINT problem_library_category_check 
CHECK (category IN ('護理', '社工', '物理治療', '職業治療', '言語治療', '營養師', '醫生'));

ALTER TABLE care_plan_problems DROP CONSTRAINT IF EXISTS care_plan_problems_problem_category_check;
ALTER TABLE care_plan_problems 
ADD CONSTRAINT care_plan_problems_problem_category_check 
CHECK (problem_category IN ('護理', '社工', '物理治療', '職業治療', '言語治療', '營養師', '醫生'));

-- 新增註解說明
COMMENT ON COLUMN care_plans.case_conference_date IS '個案會議日期';
COMMENT ON COLUMN care_plans.case_conference_professionals IS '各專業評估者和評估日期 (JSON array)';
COMMENT ON COLUMN care_plans.family_contact_date IS '聯絡家屬/報告日期';
COMMENT ON COLUMN care_plans.family_member_name IS '院友家屬姓名';
