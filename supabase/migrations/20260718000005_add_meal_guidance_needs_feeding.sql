-- 在餐膳指引表新增「需喂食」欄位
ALTER TABLE meal_guidance
ADD COLUMN IF NOT EXISTS needs_feeding boolean DEFAULT false;
