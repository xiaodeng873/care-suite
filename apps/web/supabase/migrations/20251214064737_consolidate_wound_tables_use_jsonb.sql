/*
  # 整合傷口表格 - 使用 JSONB 方式

  ## 變更說明
  刪除獨立的 `wound_details` 表，統一使用 `wound_assessments` 表中的 `wound_details` JSONB 欄位來儲存所有傷口詳細資料。

  ## 1. 資料整合
    - 如果獨立的 `wound_details` 表中有資料，將其遷移至 `wound_assessments.wound_details` JSONB 欄位
    - 確保不會遺失任何現有資料

  ## 2. 刪除獨立表格
    - 刪除 `wound_details` 表
    - 清理相關的外鍵約束

  ## 3. 優點
    - 簡化資料結構
    - 一個評估的所有傷口資料集中儲存
    - 查詢更簡單，不需要 JOIN
    - 與現有代碼完全相容
*/

-- ============================================
-- 1. 資料遷移（如果 wound_details 表中有資料）
-- ============================================

-- 將獨立表中的資料合併到 wound_assessments.wound_details JSONB 欄位
DO $$
DECLARE
  assessment_record RECORD;
  wound_details_json JSONB;
BEGIN
  -- 檢查 wound_details 表是否存在且有資料
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'wound_details' AND table_schema = 'public'
  ) THEN
    
    -- 遍歷每個 wound_assessment
    FOR assessment_record IN 
      SELECT DISTINCT wound_assessment_id 
      FROM wound_details 
      WHERE wound_assessment_id IS NOT NULL
    LOOP
      -- 收集該評估的所有傷口資料
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', id::text,
          'wound_location', wound_location,
          'wound_photos', COALESCE(wound_photos, '[]'::jsonb),
          'area_length', area_length,
          'area_width', area_width,
          'area_depth', area_depth,
          'stage', stage,
          'exudate_present', COALESCE(exudate_present, false),
          'exudate_amount', exudate_amount,
          'exudate_color', exudate_color,
          'exudate_type', exudate_type,
          'odor', COALESCE(odor, '無'),
          'granulation', COALESCE(granulation, '無'),
          'necrosis', COALESCE(necrosis, '無'),
          'infection', COALESCE(infection, '無'),
          'temperature', COALESCE(temperature, '正常'),
          'surrounding_skin_condition', surrounding_skin_condition,
          'surrounding_skin_color', surrounding_skin_color,
          'cleanser', COALESCE(cleanser, 'Normal Saline'),
          'cleanser_other', cleanser_other,
          'dressings', COALESCE(dressings, '[]'::jsonb),
          'dressing_other', dressing_other,
          'wound_status', COALESCE(wound_status, '未處理'),
          'responsible_unit', COALESCE(responsible_unit, '本院'),
          'remarks', remarks
        )
      ), '[]'::jsonb)
      INTO wound_details_json
      FROM wound_details
      WHERE wound_assessment_id = assessment_record.wound_assessment_id;

      -- 更新 wound_assessments 表
      UPDATE wound_assessments
      SET wound_details = wound_details_json,
          updated_at = now()
      WHERE id = assessment_record.wound_assessment_id;

    END LOOP;
  END IF;
END $$;

-- ============================================
-- 2. 刪除獨立的 wound_details 表
-- ============================================

-- 刪除外鍵約束（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_wound_assessment_id' 
    AND table_name = 'wound_details'
  ) THEN
    ALTER TABLE wound_details DROP CONSTRAINT fk_wound_assessment_id;
  END IF;
END $$;

-- 刪除 wound_details 表
DROP TABLE IF EXISTS wound_details CASCADE;

-- ============================================
-- 3. 驗證和優化
-- ============================================

-- 確保 wound_details JSONB 欄位的索引存在
CREATE INDEX IF NOT EXISTS idx_wound_assessments_wound_details 
ON wound_assessments USING gin(wound_details);

-- 確保 wound_assessments 表的其他重要索引存在
CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient_id 
ON wound_assessments(patient_id);

CREATE INDEX IF NOT EXISTS idx_wound_assessments_assessment_date 
ON wound_assessments(assessment_date);

CREATE INDEX IF NOT EXISTS idx_wound_assessments_next_assessment_date 
ON wound_assessments(next_assessment_date);

CREATE INDEX IF NOT EXISTS idx_wound_assessments_wound_status 
ON wound_assessments(wound_status);

CREATE INDEX IF NOT EXISTS idx_wound_assessments_wound_type 
ON wound_assessments(wound_type);

-- 整合完成
