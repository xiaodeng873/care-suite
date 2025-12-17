/*
  # 傷口管理系統

  1. 新增表格
    - `wound_assessments` 傷口評估主表
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key to 院友主表)
      - `assessment_date` (date) 評估日期
      - `next_assessment_date` (date) 下次評估日期
      - `assessor` (text) 評估者
      - `wound_location` (jsonb) 傷口位置 (人形圖座標)
      - `area_length` (numeric) 長度 (cm)
      - `area_width` (numeric) 闊度 (cm)
      - `area_depth` (numeric) 深度 (cm)
      - `stage` (text) 階段
      - `exudate_present` (boolean) 是否有滲出物
      - `exudate_amount` (text) 滲出物量
      - `exudate_color` (text) 滲出物顏色
      - `exudate_type` (text) 滲出物種類
      - `odor` (text) 氣味
      - `granulation` (text) 肉芽
      - `necrosis` (text) 壞死
      - `infection` (text) 感染
      - `temperature` (text) 體溫
      - `surrounding_skin_condition` (text) 周邊皮膚狀況
      - `surrounding_skin_color` (text) 周邊皮膚顏色
      - `cleanser` (text) 洗劑
      - `dressings` (jsonb) 敷料 (可複選)
      - `dressing_other` (text) 其他敷料
      - `remarks` (text) 備註
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. 安全性
    - 啟用 RLS
    - 新增已認證用戶的 CRUD 策略
*/

-- 建立傷口評估表
CREATE TABLE IF NOT EXISTS wound_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  next_assessment_date date,
  assessor text,
  wound_location jsonb DEFAULT '{"x": 0, "y": 0, "side": "front"}'::jsonb,
  area_length numeric(5,2),
  area_width numeric(5,2),
  area_depth numeric(5,2),
  stage text CHECK (stage IN ('階段1', '階段2', '階段3', '階段4', '無法評估')),
  exudate_present boolean DEFAULT false,
  exudate_amount text CHECK (exudate_amount IN ('無', '少', '中', '多')),
  exudate_color text CHECK (exudate_color IN ('紅色', '黃色', '綠色', '透明')),
  exudate_type text CHECK (exudate_type IN ('血', '膿', '血清')),
  odor text CHECK (odor IN ('無', '有', '惡臭')) DEFAULT '無',
  granulation text CHECK (granulation IN ('無', '紅色', '粉紅色')) DEFAULT '無',
  necrosis text CHECK (necrosis IN ('無', '黑色', '啡色', '黃色')) DEFAULT '無',
  infection text CHECK (infection IN ('無', '懷疑', '有')) DEFAULT '無',
  temperature text CHECK (temperature IN ('上升', '正常')) DEFAULT '正常',
  surrounding_skin_condition text CHECK (surrounding_skin_condition IN ('健康及柔軟', '腫脹', '僵硬')),
  surrounding_skin_color text CHECK (surrounding_skin_color IN ('紅色', '紅白色', '黑色')),
  cleanser text CHECK (cleanser IN ('Normal Saline', 'Hibitine', 'Betadine', '其他')) DEFAULT 'Normal Saline',
  cleanser_other text,
  dressings jsonb DEFAULT '[]'::jsonb,
  dressing_other text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient_id ON wound_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_wound_assessments_assessment_date ON wound_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_wound_assessments_next_assessment_date ON wound_assessments(next_assessment_date);
CREATE INDEX IF NOT EXISTS idx_wound_assessments_stage ON wound_assessments(stage);
CREATE INDEX IF NOT EXISTS idx_wound_assessments_infection ON wound_assessments(infection);
CREATE INDEX IF NOT EXISTS idx_wound_assessments_dressings ON wound_assessments USING gin(dressings);

-- 啟用 RLS
ALTER TABLE wound_assessments ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 策略
CREATE POLICY "允許已認證用戶讀取傷口評估"
  ON wound_assessments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增傷口評估"
  ON wound_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新傷口評估"
  ON wound_assessments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除傷口評估"
  ON wound_assessments
  FOR DELETE
  TO authenticated
  USING (true);

-- 建立更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_wound_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
CREATE TRIGGER update_wound_assessments_updated_at
  BEFORE UPDATE ON wound_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_wound_assessments_updated_at();