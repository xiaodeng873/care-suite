/*
  # 餐膳指引加入鼻胃飼選項及相關欄位

  1. Changes
    - 在 meal_combination_type 枚舉加入 '鼻胃飼'
    - 在 meal_guidance 表格加入 tube_feeding_brand（鼻胃管奶水品牌）
    - 在 meal_guidance 表格加入 tube_feeding_daily_amount_ml（鼻胃管每天餐量 ml）

  2. 安全性
    - 維持現有 RLS 政策
*/

-- 餐膳組合枚舉加入鼻胃飼
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = '鼻胃飼'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'meal_combination_type')
  ) THEN
    ALTER TYPE meal_combination_type ADD VALUE '鼻胃飼';
  END IF;
END $$;

-- 新增鼻胃飼相關欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_guidance' AND column_name = 'tube_feeding_brand'
  ) THEN
    ALTER TABLE meal_guidance ADD COLUMN tube_feeding_brand text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_guidance' AND column_name = 'tube_feeding_daily_amount_ml'
  ) THEN
    ALTER TABLE meal_guidance ADD COLUMN tube_feeding_daily_amount_ml integer;
  END IF;
END $$;

-- 註解
COMMENT ON COLUMN meal_guidance.tube_feeding_brand IS '鼻胃管奶水品牌，僅在 meal_combination = 鼻胃飼 時使用';
COMMENT ON COLUMN meal_guidance.tube_feeding_daily_amount_ml IS '鼻胃管每天餐量（ml），僅在 meal_combination = 鼻胃飼 時使用';

-- 索引
CREATE INDEX IF NOT EXISTS idx_meal_guidance_tube_feeding_brand ON meal_guidance (tube_feeding_brand) WHERE tube_feeding_brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_guidance_tube_feeding_amount ON meal_guidance (tube_feeding_daily_amount_ml) WHERE tube_feeding_daily_amount_ml IS NOT NULL;
