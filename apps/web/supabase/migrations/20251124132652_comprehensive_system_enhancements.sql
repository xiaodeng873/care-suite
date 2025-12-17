/*
  # 系統全面功能增強

  ## 1. 傷口管理增強
    - 在 wound_assessments 表中新增 wound_type (傷口類型) 欄位
    - 在 wound_assessments 表中新增 wound_status (傷口狀態) 欄位
    - 在 wound_assessments 表中新增 responsible_unit (負責單位) 欄位
    - 支援多個傷口記錄（使用 wound_details JSONB）

  ## 2. 退住機制強化
    - 在院友主表中新增 discharge_reason (退住原因) 欄位
    - 在院友主表中新增 death_date (死亡日期) 欄位
    - 在院友主表中新增 transfer_facility_name (轉往機構名稱) 欄位

  ## 3. 任務管理擴充
    - 新增「氧氣喉管清洗/更換」護理任務類型到 health_record_type 枚舉

  ## 4. 健康評估表單重構
    - 在 health_assessments 表中新增 treatment_items (治療項目) JSONB 欄位
    - 在 health_assessments 表中新增 toilet_training (如廁訓練) 欄位
    - 在 health_assessments 表中新增 behavior_expression (行為表現) 欄位
    - 更新 bowel_bladder_control JSONB 結構支援如廁訓練

  ## 5. 安全性
    - 所有新增欄位均遵循現有 RLS 策略
*/

-- ============================================
-- 1. 傷口管理增強
-- ============================================

-- 檢查並新增 wound_type 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments' AND column_name = 'wound_type'
  ) THEN
    ALTER TABLE wound_assessments
    ADD COLUMN wound_type text CHECK (wound_type IN ('壓力性', '手術性', '撕裂', '擦損', '割傷', '挫傷'));
  END IF;
END $$;

-- 檢查並新增 wound_status 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments' AND column_name = 'wound_status'
  ) THEN
    ALTER TABLE wound_assessments
    ADD COLUMN wound_status text CHECK (wound_status IN ('未處理', '治療中', '已痊癒')) DEFAULT '未處理';
  END IF;
END $$;

-- 檢查並新增 responsible_unit 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments' AND column_name = 'responsible_unit'
  ) THEN
    ALTER TABLE wound_assessments
    ADD COLUMN responsible_unit text CHECK (responsible_unit IN ('本院', '社康')) DEFAULT '本院';
  END IF;
END $$;

-- 檢查並新增 wound_details 欄位以支援多個傷口
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments' AND column_name = 'wound_details'
  ) THEN
    ALTER TABLE wound_assessments
    ADD COLUMN wound_details jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 新增 wound_details 的 GIN 索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_wound_assessments_wound_details ON wound_assessments USING gin(wound_details);

-- ============================================
-- 2. 退住機制強化
-- ============================================

-- 檢查並新增 discharge_reason 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'discharge_reason'
  ) THEN
    ALTER TABLE "院友主表"
    ADD COLUMN discharge_reason text CHECK (discharge_reason IN ('死亡', '回家', '留醫', '轉往其他機構'));
  END IF;
END $$;

-- 檢查並新增 death_date 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'death_date'
  ) THEN
    ALTER TABLE "院友主表"
    ADD COLUMN death_date date;
  END IF;
END $$;

-- 檢查並新增 transfer_facility_name 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'transfer_facility_name'
  ) THEN
    ALTER TABLE "院友主表"
    ADD COLUMN transfer_facility_name text;
  END IF;
END $$;

-- 新增索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_patients_discharge_reason ON "院友主表"(discharge_reason);
CREATE INDEX IF NOT EXISTS idx_patients_death_date ON "院友主表"(death_date);

-- ============================================
-- 3. 任務管理擴充
-- ============================================

-- 檢查 health_record_type 枚舉是否存在
DO $$
BEGIN
  -- 檢查枚舉類型是否存在
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_record_type') THEN
    -- 檢查「氧氣喉管清洗/更換」是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'health_record_type'::regtype
      AND enumlabel = '氧氣喉管清洗/更換'
    ) THEN
      ALTER TYPE health_record_type ADD VALUE '氧氣喉管清洗/更換';
    END IF;
  END IF;
END $$;

-- ============================================
-- 4. 健康評估表單重構
-- ============================================

-- 檢查並新增 treatment_items 欄位（治療項目）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'treatment_items'
  ) THEN
    ALTER TABLE health_assessments
    ADD COLUMN treatment_items jsonb DEFAULT '[]'::jsonb;

    COMMENT ON COLUMN health_assessments.treatment_items IS '治療項目：腹膜/血液透析、氧氣治療';
  END IF;
END $$;

-- 檢查並新增 toilet_training 欄位（如廁訓練）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'toilet_training'
  ) THEN
    ALTER TABLE health_assessments
    ADD COLUMN toilet_training boolean DEFAULT false;

    COMMENT ON COLUMN health_assessments.toilet_training IS '如廁訓練';
  END IF;
END $$;

-- 檢查並新增 behavior_expression 欄位（行為表現）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'behavior_expression'
  ) THEN
    ALTER TABLE health_assessments
    ADD COLUMN behavior_expression text CHECK (behavior_expression IN ('遊走', '逃跑', '暴力', '偷竊', '夢遊', '囤積', ''));

    COMMENT ON COLUMN health_assessments.behavior_expression IS '行為表現：遊走、逃跑、暴力、偷竊、夢遊、囤積';
  END IF;
END $$;

-- 新增索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_health_assessments_treatment_items ON health_assessments USING gin(treatment_items);
CREATE INDEX IF NOT EXISTS idx_health_assessments_toilet_training ON health_assessments(toilet_training);
CREATE INDEX IF NOT EXISTS idx_health_assessments_behavior_expression ON health_assessments(behavior_expression);

-- ============================================
-- 5. 建立統計報表用的輔助函數
-- ============================================

-- 創建函數：計算當月累積死亡人數
CREATE OR REPLACE FUNCTION get_monthly_death_count(target_month date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  death_count integer;
BEGIN
  SELECT COUNT(*)
  INTO death_count
  FROM "院友主表"
  WHERE discharge_reason = '死亡'
    AND death_date >= date_trunc('month', target_month)
    AND death_date < date_trunc('month', target_month) + interval '1 month';

  RETURN COALESCE(death_count, 0);
END;
$$;

-- 創建函數：計算特定日期的退住人數
CREATE OR REPLACE FUNCTION get_daily_discharge_count(target_date date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  discharge_count integer;
BEGIN
  SELECT COUNT(*)
  INTO discharge_count
  FROM "院友主表"
  WHERE "退住日期" = target_date;

  RETURN COALESCE(discharge_count, 0);
END;
$$;

-- 創建函數：計算24小時內死亡人數（按性別）
CREATE OR REPLACE FUNCTION get_24h_death_count_by_gender(target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(gender text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    "性別" as gender,
    COUNT(*) as count
  FROM "院友主表"
  WHERE discharge_reason = '死亡'
    AND death_date >= target_date - interval '1 day'
    AND death_date <= target_date
  GROUP BY "性別";
END;
$$;

-- 創建函數：計算壓瘡人數（未處理/治療中且類型為壓力性）
CREATE OR REPLACE FUNCTION get_pressure_ulcer_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ulcer_count integer;
BEGIN
  SELECT COUNT(DISTINCT patient_id)
  INTO ulcer_count
  FROM wound_assessments
  WHERE wound_status IN ('未處理', '治療中')
    AND (
      wound_type = '壓力性'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(wound_details) AS detail
        WHERE detail->>'wound_type' = '壓力性'
          AND detail->>'wound_status' IN ('未處理', '治療中')
      )
    );

  RETURN COALESCE(ulcer_count, 0);
END;
$$;

-- ============================================
-- 6. 權限設定
-- ============================================

-- 授予已認證用戶執行統計函數的權限
GRANT EXECUTE ON FUNCTION get_monthly_death_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_discharge_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_24h_death_count_by_gender TO authenticated;
GRANT EXECUTE ON FUNCTION get_pressure_ulcer_count TO authenticated;

-- ============================================
-- 7. 資料完整性檢查
-- ============================================

-- 確保死亡原因的院友有死亡日期
DO $$
BEGIN
  -- 為已有死亡記錄但無死亡日期的院友，使用退住日期作為死亡日期
  UPDATE "院友主表"
  SET death_date = "退住日期"
  WHERE discharge_reason = '死亡'
    AND death_date IS NULL
    AND "退住日期" IS NOT NULL;
END $$;