-- 取消社工部，歸入行政部；新增庶務部統屬廚師、清潔員
-- 注意：「庶務」enum 值已在 20260808100000_add_department_type_general_affairs.sql 中加入

-- 1. 把原社工部員工歸入行政部
UPDATE public.user_profiles
SET department = '行政'
WHERE department = '社工';

-- 2. 把原膳食部員工歸入庶務部
UPDATE public.user_profiles
SET department = '庶務'
WHERE department = '膳食';

-- 3. 把原衛生部清潔員職位遷移到庶務部（以 other_position 儲存）
UPDATE public.user_profiles
SET department = '庶務',
    other_position = '清潔員',
    hygiene_position = null
WHERE department = '衛生' AND hygiene_position = '清潔員';
