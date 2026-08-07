-- 排班管理：班次指派增加所屬統計職位，用於跨職位替補時的工時歸屬

ALTER TABLE user_shift_assignments
  ADD COLUMN IF NOT EXISTS position text;

COMMENT ON COLUMN user_shift_assignments.position IS '該班次所屬的統計職位（如 註冊/登記護士、保健員），NULL 時以員工自身職位回退';
