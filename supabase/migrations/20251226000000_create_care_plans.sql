-- 個人照顧計劃 (Individual Care Plan - ICP) 資料庫架構
-- 創建日期: 2025-12-26

-- ============================================
-- 1. 問題庫表 (Problem Library)
-- 按專業分類：護理、物理治療、職業治療、言語治療、營養師、醫生
-- ============================================
CREATE TABLE IF NOT EXISTS problem_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,                         -- 問題代碼（如：N001, PT001）
  name TEXT NOT NULL,                         -- 問題名稱
  category TEXT NOT NULL CHECK (category IN ('護理', '物理治療', '職業治療', '言語治療', '營養師', '醫生')),
  description TEXT,                           -- 問題說明
  expected_goals TEXT[] DEFAULT '{}',         -- 期待目標（預設模板，多個）
  interventions TEXT[] DEFAULT '{}',          -- 介入方式（預設模板，多個）
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,                            -- 建立者
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 問題庫索引
CREATE INDEX idx_problem_library_category ON problem_library(category);
CREATE INDEX idx_problem_library_is_active ON problem_library(is_active);
CREATE UNIQUE INDEX idx_problem_library_code ON problem_library(code);

-- ============================================
-- 2. 護理需要項目表 (Nursing Need Items)
-- 預設8個項目 + 用戶自訂項目
-- ============================================
CREATE TABLE IF NOT EXISTS nursing_need_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                  -- 項目名稱
  is_default BOOLEAN DEFAULT false,           -- 是否為預設項目（預設項目不可刪除）
  display_order INTEGER DEFAULT 0,            -- 顯示順序
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入預設護理需要項目
INSERT INTO nursing_need_items (name, is_default, display_order) VALUES
  ('整體', true, 0),
  ('失禁', true, 1),
  ('傷口', true, 2),
  ('壓力性損傷', true, 3),
  ('導尿管', true, 4),
  ('鼻胃管', true, 5),
  ('吸氧', true, 6),
  ('腹膜透析', true, 7)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. 個人照顧計劃主表 (Care Plans)
-- ============================================
CREATE TABLE IF NOT EXISTS care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id INTEGER NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  parent_plan_id UUID REFERENCES care_plans(id) ON DELETE SET NULL,  -- 父計劃ID（用於追蹤復檢版本鏈）
  version_number INTEGER DEFAULT 1,           -- 版本號
  plan_type TEXT NOT NULL CHECK (plan_type IN ('首月計劃', '半年計劃', '年度計劃')),
  plan_date DATE NOT NULL,                    -- 計劃日期
  review_due_date DATE,                       -- 復檢到期日（自動計算）
  reviewed_at TIMESTAMPTZ,                    -- 已復檢時間
  reviewed_by TEXT,                           -- 復檢人員
  created_by TEXT,                            -- 建立人員
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 計劃表索引
CREATE INDEX idx_care_plans_patient_id ON care_plans(patient_id);
CREATE INDEX idx_care_plans_status ON care_plans(status);
CREATE INDEX idx_care_plans_plan_type ON care_plans(plan_type);
CREATE INDEX idx_care_plans_parent_plan_id ON care_plans(parent_plan_id);
CREATE INDEX idx_care_plans_plan_date ON care_plans(plan_date DESC);

-- ============================================
-- 4. 照顧計劃護理需要表 (Care Plan Nursing Needs)
-- 每份計劃的護理需要勾選記錄
-- ============================================
CREATE TABLE IF NOT EXISTS care_plan_nursing_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  nursing_need_item_id UUID NOT NULL REFERENCES nursing_need_items(id) ON DELETE CASCADE,
  has_need BOOLEAN DEFAULT false,             -- 有/沒有
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(care_plan_id, nursing_need_item_id)
);

-- 護理需要索引
CREATE INDEX idx_care_plan_nursing_needs_care_plan_id ON care_plan_nursing_needs(care_plan_id);

-- ============================================
-- 5. 照顧計劃問題表 (Care Plan Problems)
-- 每份計劃的問題明細
-- ============================================
CREATE TABLE IF NOT EXISTS care_plan_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  problem_library_id UUID REFERENCES problem_library(id) ON DELETE SET NULL,  -- 可選連結到問題庫
  problem_category TEXT NOT NULL CHECK (problem_category IN ('護理', '物理治療', '職業治療', '言語治療', '營養師', '醫生')),
  problem_description TEXT NOT NULL,          -- 問題描述
  expected_goals TEXT[] DEFAULT '{}',         -- 期待目標（多個）
  interventions TEXT[] DEFAULT '{}',          -- 介入方式（多個）
  outcome_review TEXT CHECK (outcome_review IN ('保持現狀', '滿意', '部分滿意', '需要持續改善')),  -- 成效檢討
  problem_assessor TEXT,                      -- 問題評估者
  outcome_assessor TEXT,                      -- 成效評估者
  display_order INTEGER DEFAULT 0,            -- 顯示順序
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 問題明細索引
CREATE INDEX idx_care_plan_problems_care_plan_id ON care_plan_problems(care_plan_id);
CREATE INDEX idx_care_plan_problems_problem_library_id ON care_plan_problems(problem_library_id);
CREATE INDEX idx_care_plan_problems_category ON care_plan_problems(problem_category);

-- ============================================
-- 6. 觸發器：自動更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_care_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_care_plans_updated_at
  BEFORE UPDATE ON care_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_care_plan_updated_at();

CREATE TRIGGER trigger_problem_library_updated_at
  BEFORE UPDATE ON problem_library
  FOR EACH ROW
  EXECUTE FUNCTION update_care_plan_updated_at();

CREATE TRIGGER trigger_nursing_need_items_updated_at
  BEFORE UPDATE ON nursing_need_items
  FOR EACH ROW
  EXECUTE FUNCTION update_care_plan_updated_at();

CREATE TRIGGER trigger_care_plan_nursing_needs_updated_at
  BEFORE UPDATE ON care_plan_nursing_needs
  FOR EACH ROW
  EXECUTE FUNCTION update_care_plan_updated_at();

CREATE TRIGGER trigger_care_plan_problems_updated_at
  BEFORE UPDATE ON care_plan_problems
  FOR EACH ROW
  EXECUTE FUNCTION update_care_plan_updated_at();

-- ============================================
-- 7. 觸發器：自動計算復檢到期日
-- ============================================
CREATE OR REPLACE FUNCTION calculate_review_due_date()
RETURNS TRIGGER AS $$
BEGIN
  -- 根據計劃類型計算復檢到期日
  IF NEW.plan_type = '首月計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '6 months';
  ELSIF NEW.plan_type = '半年計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '6 months';
  ELSIF NEW.plan_type = '年度計劃' THEN
    NEW.review_due_date = NEW.plan_date + INTERVAL '12 months';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_review_due_date
  BEFORE INSERT OR UPDATE OF plan_type, plan_date ON care_plans
  FOR EACH ROW
  EXECUTE FUNCTION calculate_review_due_date();

-- ============================================
-- 8. RLS 政策
-- ============================================
ALTER TABLE problem_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE nursing_need_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plan_nursing_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plan_problems ENABLE ROW LEVEL SECURITY;

-- 允許已認證用戶完整存取
CREATE POLICY "Allow authenticated users full access to problem_library"
  ON problem_library FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to nursing_need_items"
  ON nursing_need_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to care_plans"
  ON care_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to care_plan_nursing_needs"
  ON care_plan_nursing_needs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to care_plan_problems"
  ON care_plan_problems FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 9. 插入預設問題庫範例資料
-- ============================================
INSERT INTO problem_library (code, name, category, description, expected_goals, interventions) VALUES
  -- 護理類
  ('N001', '皮膚完整性受損', '護理', '院友皮膚出現破損、潰瘍或壓瘡風險', 
   ARRAY['維持皮膚完整性', '促進傷口癒合', '預防繼發感染'],
   ARRAY['定時翻身減壓', '保持皮膚清潔乾燥', '使用減壓墊', '傷口護理']),
  ('N002', '營養攝取不足', '護理', '院友進食量不足或體重下降',
   ARRAY['維持穩定體重', '改善營養狀況', '達到每日建議攝取量'],
   ARRAY['監測每日進食量', '提供高熱量飲食', '少量多餐', '必要時使用營養補充品']),
  ('N003', '活動能力受限', '護理', '院友行動能力下降或需要協助',
   ARRAY['維持現有活動能力', '預防跌倒', '延緩功能退化'],
   ARRAY['協助日常活動', '使用輔助器具', '定時進行關節活動', '跌倒風險評估']),
  ('N004', '排泄功能障礙', '護理', '院友有失禁或排泄困難問題',
   ARRAY['維持排泄規律', '預防皮膚問題', '保持舒適清潔'],
   ARRAY['定時如廁訓練', '使用適當失禁用品', '保持會陰清潔', '監測排泄情況']),
  
  -- 物理治療類
  ('PT001', '步態異常', '物理治療', '院友行走姿勢或步態有問題',
   ARRAY['改善步態穩定性', '增加行走距離', '減少跌倒風險'],
   ARRAY['步態訓練', '平衡訓練', '使用適當輔具', '肌力訓練']),
  ('PT002', '關節活動度受限', '物理治療', '院友關節僵硬或活動範圍減少',
   ARRAY['維持關節活動度', '增加關節靈活性', '減輕疼痛'],
   ARRAY['被動關節活動', '主動輔助運動', '伸展運動', '熱敷']),
  
  -- 職業治療類
  ('OT001', '日常生活功能障礙', '職業治療', '院友自理能力下降',
   ARRAY['維持自理能力', '提升獨立性', '適應輔具使用'],
   ARRAY['自理訓練', '輔具評估與訓練', '環境改造建議', '精細動作訓練']),
  
  -- 言語治療類
  ('ST001', '吞嚥困難', '言語治療', '院友進食時有噎嗆或吞嚥問題',
   ARRAY['安全進食', '減少嗆咳次數', '維持營養攝取'],
   ARRAY['吞嚥訓練', '調整食物質地', '進食姿勢指導', '口腔肌肉運動']),
  ('ST002', '溝通障礙', '言語治療', '院友表達或理解語言有困難',
   ARRAY['改善溝通能力', '增加表達意願', '提升社交互動'],
   ARRAY['言語訓練', '輔助溝通工具', '認知訓練', '社交技巧訓練']),
  
  -- 營養師類
  ('DT001', '體重過輕', '營養師', '院友BMI過低或體重持續下降',
   ARRAY['體重增加', '改善營養狀況', '達到理想BMI'],
   ARRAY['高熱量飲食計劃', '營養補充品', '監測體重', '少量多餐']),
  ('DT002', '糖尿病飲食管理', '營養師', '院友需要控制血糖飲食',
   ARRAY['穩定血糖', '預防併發症', '維持適當體重'],
   ARRAY['糖尿病飲食計劃', '定時定量進食', '監測血糖', '衛教指導']),
  
  -- 醫生類
  ('MD001', '慢性疾病管理', '醫生', '院友有多種慢性疾病需要管理',
   ARRAY['穩定病情', '預防併發症', '維持生活品質'],
   ARRAY['定期覆診', '藥物調整', '監測生命徵象', '健康教育'])
ON CONFLICT DO NOTHING;

-- 完成
COMMENT ON TABLE care_plans IS '個人照顧計劃主表';
COMMENT ON TABLE care_plan_problems IS '個人照顧計劃問題明細表';
COMMENT ON TABLE care_plan_nursing_needs IS '個人照顧計劃護理需要表';
COMMENT ON TABLE problem_library IS '問題庫（按專業分類）';
COMMENT ON TABLE nursing_need_items IS '護理需要項目表';
