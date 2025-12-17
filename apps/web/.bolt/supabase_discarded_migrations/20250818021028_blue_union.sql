/*
  # 創建傷口評估相關表

  1. 新表
    - `wound_assessments` - 傷口評估主表
    - `wound_details` - 傷口詳細信息表（支持多個傷口座標）
  
  2. 安全性
    - 啟用 RLS
    - 為已認證用戶添加策略
  
  3. 觸發器
    - 自動更新 updated_at 字段
*/

-- 創建傷口評估主表
CREATE TABLE IF NOT EXISTS public.wound_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id integer NOT NULL,
    assessment_date date NOT NULL DEFAULT CURRENT_DATE,
    next_assessment_date date,
    assessor text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 創建傷口詳細信息表（支持多個傷口）
CREATE TABLE IF NOT EXISTS public.wound_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wound_assessment_id uuid NOT NULL,
    wound_location jsonb DEFAULT '{"x": 0, "y": 0, "side": "front"}'::jsonb,
    area_length numeric(5,2),
    area_width numeric(5,2),
    area_depth numeric(5,2),
    stage text,
    exudate_present boolean DEFAULT false,
    exudate_amount text,
    exudate_color text,
    exudate_type text,
    odor text DEFAULT '無'::text,
    granulation text DEFAULT '無'::text,
    necrosis text DEFAULT '無'::text,
    infection text DEFAULT '無'::text,
    temperature text DEFAULT '正常'::text,
    surrounding_skin_condition text,
    surrounding_skin_color text,
    cleanser text DEFAULT 'Normal Saline'::text,
    cleanser_other text,
    dressings jsonb DEFAULT '[]'::jsonb,
    dressing_other text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 添加外鍵約束
ALTER TABLE public.wound_assessments
ADD CONSTRAINT wound_assessments_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES public."院友主表"("院友id") ON DELETE CASCADE;

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_wound_assessment_id_fkey 
FOREIGN KEY (wound_assessment_id) REFERENCES public.wound_assessments(id) ON DELETE CASCADE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient_id ON public.wound_assessments USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_wound_assessments_assessment_date ON public.wound_assessments USING btree (assessment_date);
CREATE INDEX IF NOT EXISTS idx_wound_assessments_next_assessment_date ON public.wound_assessments USING btree (next_assessment_date);

CREATE INDEX IF NOT EXISTS idx_wound_details_wound_assessment_id ON public.wound_details USING btree (wound_assessment_id);
CREATE INDEX IF NOT EXISTS idx_wound_details_stage ON public.wound_details USING btree (stage);
CREATE INDEX IF NOT EXISTS idx_wound_details_infection ON public.wound_details USING btree (infection);
CREATE INDEX IF NOT EXISTS idx_wound_details_dressings ON public.wound_details USING gin (dressings);

-- 啟用 Row Level Security
ALTER TABLE public.wound_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wound_details ENABLE ROW LEVEL SECURITY;

-- 為 wound_assessments 表添加 RLS 策略
CREATE POLICY "允許已認證用戶新增傷口評估"
ON public.wound_assessments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶讀取傷口評估"
ON public.wound_assessments FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶更新傷口評估"
ON public.wound_assessments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除傷口評估"
ON public.wound_assessments FOR DELETE TO authenticated USING (true);

-- 為 wound_details 表添加 RLS 策略
CREATE POLICY "允許已認證用戶新增傷口詳細信息"
ON public.wound_details FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶讀取傷口詳細信息"
ON public.wound_details FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶更新傷口詳細信息"
ON public.wound_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除傷口詳細信息"
ON public.wound_details FOR DELETE TO authenticated USING (true);

-- 創建觸發器函數（如果不存在）
CREATE OR REPLACE FUNCTION public.update_wound_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_wound_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS update_wound_assessments_updated_at ON public.wound_assessments;
CREATE TRIGGER update_wound_assessments_updated_at
BEFORE UPDATE ON public.wound_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_wound_assessments_updated_at();

DROP TRIGGER IF EXISTS update_wound_details_updated_at ON public.wound_details;
CREATE TRIGGER update_wound_details_updated_at
BEFORE UPDATE ON public.wound_details
FOR EACH ROW EXECUTE FUNCTION public.update_wound_details_updated_at();

-- 添加約束檢查
ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_stage_check 
CHECK (stage = ANY (ARRAY['階段1'::text, '階段2'::text, '階段3'::text, '階段4'::text, '無法評估'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_exudate_amount_check 
CHECK (exudate_amount = ANY (ARRAY['無'::text, '少'::text, '中'::text, '多'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_exudate_color_check 
CHECK (exudate_color = ANY (ARRAY['紅色'::text, '黃色'::text, '綠色'::text, '透明'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_exudate_type_check 
CHECK (exudate_type = ANY (ARRAY['血'::text, '膿'::text, '血清'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_odor_check 
CHECK (odor = ANY (ARRAY['無'::text, '有'::text, '惡臭'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_granulation_check 
CHECK (granulation = ANY (ARRAY['無'::text, '紅色'::text, '粉紅色'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_necrosis_check 
CHECK (necrosis = ANY (ARRAY['無'::text, '黑色'::text, '啡色'::text, '黃色'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_infection_check 
CHECK (infection = ANY (ARRAY['無'::text, '懷疑'::text, '有'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_temperature_check 
CHECK (temperature = ANY (ARRAY['上升'::text, '正常'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_surrounding_skin_condition_check 
CHECK (surrounding_skin_condition = ANY (ARRAY['健康及柔軟'::text, '腫脹'::text, '僵硬'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_surrounding_skin_color_check 
CHECK (surrounding_skin_color = ANY (ARRAY['紅色'::text, '紅白色'::text, '黑色'::text]));

ALTER TABLE public.wound_details
ADD CONSTRAINT wound_details_cleanser_check 
CHECK (cleanser = ANY (ARRAY['Normal Saline'::text, 'Hibitine'::text, 'Betadine'::text, '其他'::text]));