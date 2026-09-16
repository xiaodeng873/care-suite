/*
  # 餐膳指引加入需限水

  1. 變更
    - 在 meal_guidance 表格加入 needs_water_restriction（需限水）及 water_restriction_amount_ml（每日限水量，ml）
    - 僅在 needs_water_restriction = true 時使用 water_restriction_amount_ml
*/

ALTER TABLE meal_guidance ADD COLUMN IF NOT EXISTS needs_water_restriction boolean NOT NULL DEFAULT false;

ALTER TABLE meal_guidance ADD COLUMN IF NOT EXISTS water_restriction_amount_ml integer;

COMMENT ON COLUMN meal_guidance.needs_water_restriction IS '需限水（true 時使用 water_restriction_amount_ml）';

COMMENT ON COLUMN meal_guidance.water_restriction_amount_ml IS '每日限水量（ml），僅在 needs_water_restriction = true 時使用';
