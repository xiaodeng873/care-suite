-- 班次指派新增 sort_order，用於同班次內多張卡片的顯示排序
ALTER TABLE user_shift_assignments
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN user_shift_assignments.sort_order IS '同班次內多張卡片的顯示排序，數字越小越靠前';
