/*
  # 傷口管理系統重構

  ## 設計變更
  原始設計：wound_assessments 表中使用 wound_details JSONB 存放多個傷口
  新設計：分離為 wounds (傷口主表) 和 wound_assessments (評估記錄表)

  ## 新數據模型
  1. wounds - 傷口主表
     - 每個傷口獨立記錄
     - 包含發現日期、位置、類型、狀態
     - 追蹤痊癒日期和下次評估到期日

  2. wound_assessments - 傷口評估記錄表
     - 關聯到特定傷口
     - 記錄每次評估的詳細資料
     - 包含測量、狀態、治療等資訊
*/

-- ============================================
-- 1. 創建 wounds 傷口主表
-- ============================================
CREATE TABLE IF NOT EXISTS wounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  wound_code text NOT NULL,
  wound_name text,
  discovery_date date NOT NULL DEFAULT CURRENT_DATE,
  wound_location jsonb DEFAULT '{"x": 0, "y": 0, "side": "front"}'::jsonb,
  wound_type text CHECK (wound_type IN ('pressure_ulcer', 'trauma', 'surgical', 'diabetic', 'venous', 'arterial', 'other')) DEFAULT 'other',
  wound_type_other text,
  wound_origin text CHECK (wound_origin IN ('facility', 'admission', 'hospital_referral')) DEFAULT 'facility',
  status text CHECK (status IN ('active', 'healed', 'transferred')) DEFAULT 'active',
  healed_date date,
  next_assessment_due date,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_wounds_patient_id ON wounds(patient_id);
CREATE INDEX IF NOT EXISTS idx_wounds_status ON wounds(status);
CREATE INDEX IF NOT EXISTS idx_wounds_discovery_date ON wounds(discovery_date);
CREATE INDEX IF NOT EXISTS idx_wounds_next_assessment_due ON wounds(next_assessment_due);

-- 唯一性約束：同一病人的傷口編號不能重複
CREATE UNIQUE INDEX IF NOT EXISTS idx_wounds_patient_wound_code ON wounds(patient_id, wound_code);

-- 啟用 RLS
ALTER TABLE wounds ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略
CREATE POLICY "允許已認證用戶讀取傷口" ON wounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "允許已認證用戶新增傷口" ON wounds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "允許已認證用戶更新傷口" ON wounds FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "允許已認證用戶刪除傷口" ON wounds FOR DELETE TO authenticated USING (true);

-- ============================================
-- 2. 修改 wound_assessments 表，添加必要欄位
-- ============================================

-- 添加 wound_id 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments' AND column_name = 'wound_id'
  ) THEN
    ALTER TABLE wound_assessments ADD COLUMN wound_id uuid REFERENCES wounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 添加 stage 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments' AND column_name = 'stage'
  ) THEN
    ALTER TABLE wound_assessments ADD COLUMN stage text CHECK (stage IN ('階段1', '階段2', '階段3', '階段4', '無法評估'));
  END IF;
END $$;

-- 添加 wound_status 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments' AND column_name = 'wound_status'
  ) THEN
    ALTER TABLE wound_assessments ADD COLUMN wound_status text CHECK (wound_status IN ('untreated', 'treating', 'improving', 'healed')) DEFAULT 'treating';
  END IF;
END $$;

-- 添加 wound_photos 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments' AND column_name = 'wound_photos'
  ) THEN
    ALTER TABLE wound_assessments ADD COLUMN wound_photos jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 創建 wound_id 索引
CREATE INDEX IF NOT EXISTS idx_wound_assessments_wound_id ON wound_assessments(wound_id);

-- ============================================
-- 3. 數據遷移：從舊 wound_details 遷移到新結構
-- ============================================

-- 遷移函數：將現有 wound_assessments 的 wound_details 轉換為 wounds 記錄
DO $$
DECLARE
  rec RECORD;
  detail JSONB;
  wound_rec RECORD;
  wound_idx INTEGER;
  new_wound_id uuid;
  wound_code_num INTEGER;
BEGIN
  -- 遍歷所有現有的 wound_assessments 記錄
  FOR rec IN 
    SELECT DISTINCT ON (patient_id) * 
    FROM wound_assessments 
    WHERE wound_id IS NULL 
      AND wound_details IS NOT NULL 
      AND jsonb_array_length(wound_details) > 0
    ORDER BY patient_id, assessment_date DESC
  LOOP
    wound_idx := 0;
    
    -- 獲取該病人目前最大的傷口編號
    SELECT COALESCE(MAX(CAST(SUBSTRING(wound_code FROM 2) AS INTEGER)), 0) INTO wound_code_num
    FROM wounds WHERE patient_id = rec.patient_id;
    
    -- 遍歷 wound_details 中的每個傷口
    FOR detail IN SELECT * FROM jsonb_array_elements(rec.wound_details)
    LOOP
      wound_idx := wound_idx + 1;
      wound_code_num := wound_code_num + 1;
      
      -- 創建傷口主記錄
      INSERT INTO wounds (
        patient_id,
        wound_code,
        wound_name,
        discovery_date,
        wound_location,
        wound_type,
        wound_origin,
        status,
        healed_date,
        next_assessment_due,
        remarks
      ) VALUES (
        rec.patient_id,
        'W' || LPAD(wound_code_num::text, 3, '0'),
        COALESCE(detail->>'wound_name', '傷口 ' || wound_idx),
        rec.assessment_date,
        COALESCE(detail->'wound_location', '{"x": 0, "y": 0, "side": "front"}'::jsonb),
        CASE 
          WHEN (detail->>'wound_type') = '壓瘡' THEN 'pressure_ulcer'
          WHEN (detail->>'wound_type') = '創傷' THEN 'trauma'
          WHEN (detail->>'wound_type') = '手術傷口' THEN 'surgical'
          WHEN (detail->>'wound_type') = '糖尿病傷口' THEN 'diabetic'
          ELSE 'other'
        END,
        CASE 
          WHEN (detail->>'responsible_unit') = '本院' THEN 'facility'
          ELSE 'admission'
        END,
        CASE 
          WHEN (detail->>'wound_status') = '已痊癒' THEN 'healed'
          ELSE 'active'
        END,
        CASE 
          WHEN (detail->>'wound_status') = '已痊癒' THEN rec.assessment_date
          ELSE NULL
        END,
        CASE 
          WHEN (detail->>'wound_status') = '已痊癒' THEN NULL
          ELSE rec.assessment_date + INTERVAL '7 days'
        END,
        detail->>'remarks'
      )
      RETURNING * INTO wound_rec;
      
      -- 保存新的 wound_id 以關聯評估記錄
      new_wound_id := wound_rec.id;
      
      -- 更新該病人該傷口位置的所有評估記錄，關聯到新傷口
      -- 注意：這裡簡化處理，實際應該根據 wound_location 匹配
      UPDATE wound_assessments
      SET wound_id = new_wound_id
      WHERE patient_id = rec.patient_id
        AND wound_id IS NULL
        AND wound_details @> jsonb_build_array(detail);
        
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '傷口數據遷移完成';
END $$;

-- ============================================
-- 4. 創建自動更新 updated_at 觸發器
-- ============================================

-- 創建更新 updated_at 的函數（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 為 wounds 表創建觸發器
DROP TRIGGER IF EXISTS update_wounds_updated_at ON wounds;
CREATE TRIGGER update_wounds_updated_at
  BEFORE UPDATE ON wounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. 創建輔助視圖：傷口與評估記錄的組合視圖
-- ============================================

CREATE OR REPLACE VIEW wound_summary AS
SELECT 
  w.id AS wound_id,
  w.patient_id,
  w.wound_code,
  w.wound_name,
  w.discovery_date,
  w.wound_location,
  w.wound_type,
  w.wound_origin,
  w.status AS wound_status,
  w.healed_date,
  w.next_assessment_due,
  COUNT(wa.id) AS assessment_count,
  MAX(wa.assessment_date) AS last_assessment_date,
  (
    SELECT stage FROM wound_assessments 
    WHERE wound_id = w.id 
    ORDER BY assessment_date DESC 
    LIMIT 1
  ) AS current_stage,
  CASE 
    WHEN w.status = 'healed' THEN false
    WHEN w.next_assessment_due IS NULL THEN false
    WHEN w.next_assessment_due < CURRENT_DATE THEN true
    ELSE false
  END AS is_overdue,
  CASE 
    WHEN w.status = 'healed' THEN NULL
    WHEN w.next_assessment_due IS NULL THEN NULL
    ELSE w.next_assessment_due - CURRENT_DATE
  END AS days_until_due
FROM wounds w
LEFT JOIN wound_assessments wa ON wa.wound_id = w.id
GROUP BY w.id;

-- ============================================
-- 6. 創建病人傷口統計視圖
-- ============================================

CREATE OR REPLACE VIEW patient_wound_stats AS
SELECT 
  p."院友id" AS patient_id,
  p."床號" AS bed_number,
  p."中文姓氏" || p."中文名字" AS patient_name,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'active') AS active_wound_count,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'healed') AS healed_wound_count,
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.status = 'active' 
    AND w.next_assessment_due < CURRENT_DATE
  ) AS overdue_assessment_count,
  ARRAY_AGG(
    DISTINCT jsonb_build_object(
      'wound_id', w.id,
      'wound_code', w.wound_code,
      'status', w.status,
      'next_due', w.next_assessment_due
    )
  ) FILTER (WHERE w.id IS NOT NULL) AS wound_list
FROM "院友主表" p
LEFT JOIN wounds w ON w.patient_id = p."院友id"
WHERE p."在住狀態" = '在住'
GROUP BY p."院友id", p."床號", p."中文姓氏", p."中文名字";

-- ============================================
-- 7. 創建傷口編號生成函數
-- ============================================

CREATE OR REPLACE FUNCTION generate_wound_code(p_patient_id integer)
RETURNS text AS $$
DECLARE
  max_num INTEGER;
  new_code TEXT;
BEGIN
  -- 獲取該病人目前最大的傷口編號
  SELECT COALESCE(MAX(CAST(SUBSTRING(wound_code FROM 2) AS INTEGER)), 0) + 1
  INTO max_num
  FROM wounds 
  WHERE patient_id = p_patient_id;
  
  -- 生成新編號 (W001, W002, ...)
  new_code := 'W' || LPAD(max_num::text, 3, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. 創建自動設定下次評估日期的觸發器
-- ============================================

CREATE OR REPLACE FUNCTION set_next_assessment_due()
RETURNS TRIGGER AS $$
BEGIN
  -- 新增傷口時，自動設定下次評估日期為發現日期 + 7 天
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' AND NEW.next_assessment_due IS NULL THEN
      NEW.next_assessment_due := NEW.discovery_date + INTERVAL '7 days';
    END IF;
  END IF;
  
  -- 更新傷口時，如果狀態變為 healed，清除下次評估日期
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'healed' THEN
      NEW.next_assessment_due := NULL;
      IF NEW.healed_date IS NULL THEN
        NEW.healed_date := CURRENT_DATE;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_wound_next_assessment ON wounds;
CREATE TRIGGER set_wound_next_assessment
  BEFORE INSERT OR UPDATE ON wounds
  FOR EACH ROW
  EXECUTE FUNCTION set_next_assessment_due();

-- ============================================
-- 9. 創建評估後更新傷口狀態的觸發器
-- ============================================

CREATE OR REPLACE FUNCTION update_wound_after_assessment()
RETURNS TRIGGER AS $$
BEGIN
  -- 新增評估記錄後，更新傷口的下次評估日期
  UPDATE wounds
  SET 
    next_assessment_due = CASE 
      WHEN (SELECT wound_status FROM wound_assessments WHERE id = NEW.id) = 'healed' THEN NULL
      ELSE NEW.assessment_date + INTERVAL '7 days'
    END,
    status = CASE 
      WHEN EXISTS (
        SELECT 1 FROM wound_assessments 
        WHERE wound_id = NEW.wound_id 
        AND wound_status = 'healed'
        ORDER BY assessment_date DESC
        LIMIT 1
      ) THEN 'healed'
      ELSE status
    END,
    healed_date = CASE 
      WHEN EXISTS (
        SELECT 1 FROM wound_assessments 
        WHERE wound_id = NEW.wound_id 
        AND wound_status = 'healed'
        ORDER BY assessment_date DESC
        LIMIT 1
      ) THEN NEW.assessment_date
      ELSE healed_date
    END,
    updated_at = now()
  WHERE id = NEW.wound_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wound_on_assessment ON wound_assessments;
CREATE TRIGGER update_wound_on_assessment
  AFTER INSERT OR UPDATE ON wound_assessments
  FOR EACH ROW
  WHEN (NEW.wound_id IS NOT NULL)
  EXECUTE FUNCTION update_wound_after_assessment();

COMMENT ON TABLE wounds IS '傷口主表 - 記錄每個傷口的基本資料和生命週期';
COMMENT ON TABLE wound_assessments IS '傷口評估記錄表 - 記錄每次傷口評估的詳細資料';
COMMENT ON VIEW wound_summary IS '傷口摘要視圖 - 組合傷口和評估記錄的統計資訊';
COMMENT ON VIEW patient_wound_stats IS '病人傷口統計視圖 - 顯示每個病人的傷口統計';
