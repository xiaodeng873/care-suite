/*
  # 修正 wound_assessments 表中非法的 status 值
  只允許 'active', 'archived'，其他一律改為 'active'
*/

UPDATE wound_assessments
SET status = 'active'
WHERE status IS NULL
   OR status::text NOT IN ('active', 'archived');
