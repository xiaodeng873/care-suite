/*
  # 餐膳指引加入凝固粉配方

  1. 變更
    - 在 meal_guidance 表格加入 thickener_formula（凝固粉配方：普遍配方 / 清透配方）
    - 僅在 needs_thickener = true 時使用，nullable
*/

ALTER TABLE meal_guidance ADD COLUMN IF NOT EXISTS thickener_formula text;

COMMENT ON COLUMN meal_guidance.thickener_formula IS '凝固粉配方（普遍配方 / 清透配方），僅在 needs_thickener = true 時使用';
