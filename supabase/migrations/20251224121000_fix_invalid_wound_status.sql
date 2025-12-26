/*
  # 修正 wound_assessments 表中非法的 wound_status 值
  只允許 'untreated', 'treating', 'improving', 'healed'，其他一律改為 'treating'
*/

UPDATE wound_assessments
SET wound_status = 'treating'
WHERE wound_status IS NULL
   OR TRIM(wound_status) = ''
   OR wound_status NOT IN ('untreated', 'treating', 'improving', 'healed');
