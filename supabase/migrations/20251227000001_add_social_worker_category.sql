-- 新增「社工」到專業類別
-- 創建日期: 2025-12-27

-- 更新 problem_library 的 category 欄位檢查約束
ALTER TABLE problem_library DROP CONSTRAINT IF EXISTS problem_library_category_check;
ALTER TABLE problem_library 
ADD CONSTRAINT problem_library_category_check 
CHECK (category IN ('護理', '社工', '物理治療', '職業治療', '言語治療', '營養師', '醫生'));

-- 更新 care_plan_problems 的 problem_category 欄位檢查約束
ALTER TABLE care_plan_problems DROP CONSTRAINT IF EXISTS care_plan_problems_problem_category_check;
ALTER TABLE care_plan_problems 
ADD CONSTRAINT care_plan_problems_problem_category_check 
CHECK (problem_category IN ('護理', '社工', '物理治療', '職業治療', '言語治療', '營養師', '醫生'));
