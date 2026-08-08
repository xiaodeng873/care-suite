-- 取消社工部，歸入行政部；新增庶務部統屬廚師、清潔員
-- 1. 確保新部門值存在於枚舉
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '庶務'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'department_type')
  ) THEN
    ALTER TYPE department_type ADD VALUE '庶務';
  END IF;
END $$;

-- 2. 把原社工部員工歸入行政部
UPDATE public.user_profiles
SET department = '行政'
WHERE department = '社工';

-- 3. 把原膳食部員工歸入庶務部
UPDATE public.user_profiles
SET department = '庶務'
WHERE department = '膳食';

-- 4. 把原衛生部清潔員職位遷移到庶務部（以 other_position 儲存）
UPDATE public.user_profiles
SET department = '庶務',
    other_position = '清潔員',
    hygiene_position = null
WHERE department = '衛生' AND hygiene_position = '清潔員';
