/*
  # 餐膳指引系統

  1. 新增表格
    - `meal_guidance` 表格
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key to 院友主表)
      - `meal_combination` (enum, 7種組合)
      - `special_diets` (jsonb array, 特殊餐膳)
      - `needs_thickener` (boolean, 是否需要凝固粉)
      - `thickener_amount` (text, 凝固粉分量)
      - `guidance_date` (date, 指引日期)
      - `guidance_source` (text, 指引出處)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 安全性
    - 啟用 RLS
    - 新增已認證用戶的政策
*/

-- 創建餐膳組合枚舉
CREATE TYPE meal_combination_type AS ENUM (
  '正飯+正餸',
  '正飯+碎餸', 
  '正飯+糊餸',
  '軟飯+正餸',
  '軟飯+碎餸',
  '軟飯+糊餸',
  '糊飯+糊餸'
);

-- 創建特殊餐膳枚舉
CREATE TYPE special_diet_type AS ENUM (
  '糖尿餐',
  '痛風餐', 
  '低鹽餐',
  '鼻胃飼'
);

-- 創建餐膳指引表格
CREATE TABLE IF NOT EXISTS meal_guidance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  meal_combination meal_combination_type NOT NULL,
  special_diets jsonb DEFAULT '[]'::jsonb,
  needs_thickener boolean DEFAULT false,
  thickener_amount text,
  guidance_date date,
  guidance_source text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE meal_guidance ENABLE ROW LEVEL SECURITY;

-- 創建政策
CREATE POLICY "允許已認證用戶讀取餐膳指引"
  ON meal_guidance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增餐膳指引"
  ON meal_guidance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新餐膳指引"
  ON meal_guidance
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除餐膳指引"
  ON meal_guidance
  FOR DELETE
  TO authenticated
  USING (true);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_meal_guidance_patient_id ON meal_guidance(patient_id);
CREATE INDEX IF NOT EXISTS idx_meal_guidance_meal_combination ON meal_guidance(meal_combination);
CREATE INDEX IF NOT EXISTS idx_meal_guidance_special_diets ON meal_guidance USING gin(special_diets);
CREATE INDEX IF NOT EXISTS idx_meal_guidance_guidance_date ON meal_guidance(guidance_date);

-- 創建更新時間觸發器
CREATE OR REPLACE FUNCTION update_meal_guidance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meal_guidance_updated_at
  BEFORE UPDATE ON meal_guidance
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_guidance_updated_at();