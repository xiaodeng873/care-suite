/*
  # 在 meal_combination_type 枚舉新增「不適用」

  1. 變更
    - 新增「不適用」到 meal_combination_type 枚舉

  2. 說明
    - 鼻胃飼改為在特別餐中勾選，不再屬於餐膳組合
    - 現有記錄會由另一 migration 搬移
    - 舊 enum 值 '鼻胃飼' 會保留在枚舉中但不再使用
*/

-- 新增「不適用」到 meal_combination_type 枚舉
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '不適用'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'meal_combination_type')
  ) THEN
    ALTER TYPE meal_combination_type ADD VALUE '不適用';
  END IF;
END $$;
