/*
  # 添加評估記錄狀態管理功能

  ## 目的
  為健康評估和傷口評估表添加狀態管理，實現：
  - 每個院友只能有一筆生效中的評估記錄
  - 支持歷史記錄查詢和編輯
  - 自動歸檔機制

  ## 變更內容
  
  ### 1. 新增狀態枚舉類型
    - `assessment_status`：定義 'active'（生效中）和 'archived'（已歸檔）兩種狀態
  
  ### 2. health_assessments 表變更
    - `status`（評估狀態）：預設為 'active'
    - `archived_at`（歸檔時間）：記錄歸檔的時間戳，可為 null
    - 添加唯一性約束：確保每個 patient_id 只能有一筆 status = 'active' 的記錄
    - 添加索引以優化查詢性能
  
  ### 3. wound_assessments 表變更
    - `status`（評估狀態）：預設為 'active'
    - `archived_at`（歸檔時間）：記錄歸檔的時間戳，可為 null
    - 添加唯一性約束：確保每個 patient_id 只能有一筆 status = 'active' 的記錄
    - 添加索引以優化查詢性能
  
  ### 4. 自動歸檔函數
    - `archive_patient_health_assessments(patient_id)`：將指定院友的所有 active 評估歸檔
    - `archive_patient_wound_assessments(patient_id)`：將指定院友的所有 active 傷口評估歸檔
  
  ### 5. 自動觸發器
    - 在插入新 active 記錄時，自動歸檔該院友的舊 active 記錄
  
  ## 注意事項
  - 歷史記錄（archived）仍然可編輯，不設只讀限制
  - 歸檔時自動記錄時間戳，不需要填寫原因
  - 唯一性約束僅應用於 active 狀態的記錄
*/

-- 1. 創建評估狀態枚舉類型
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status') THEN
    CREATE TYPE assessment_status AS ENUM ('active', 'archived');
  END IF;
END $$;

-- 2. 為 health_assessments 表添加狀態欄位
DO $$
BEGIN
  -- 添加 status 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_assessments' AND column_name = 'status'
  ) THEN
    ALTER TABLE health_assessments 
    ADD COLUMN status assessment_status NOT NULL DEFAULT 'active';
  END IF;

  -- 添加 archived_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_assessments' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE health_assessments 
    ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- 3. 為 wound_assessments 表添加狀態欄位
DO $$
BEGIN
  -- 添加 status 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wound_assessments' AND column_name = 'status'
  ) THEN
    ALTER TABLE wound_assessments 
    ADD COLUMN status assessment_status NOT NULL DEFAULT 'active';
  END IF;

  -- 添加 archived_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wound_assessments' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE wound_assessments 
    ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- 4. 創建唯一性約束（確保每個院友只有一筆 active 記錄）
DROP INDEX IF EXISTS unique_active_health_assessment;
CREATE UNIQUE INDEX unique_active_health_assessment 
ON health_assessments (patient_id) 
WHERE status = 'active';

DROP INDEX IF EXISTS unique_active_wound_assessment;
CREATE UNIQUE INDEX unique_active_wound_assessment 
ON wound_assessments (patient_id) 
WHERE status = 'active';

-- 5. 創建索引以優化查詢性能
CREATE INDEX IF NOT EXISTS idx_health_assessments_status 
ON health_assessments(status);

CREATE INDEX IF NOT EXISTS idx_health_assessments_patient_status 
ON health_assessments(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_wound_assessments_status 
ON wound_assessments(status);

CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient_status 
ON wound_assessments(patient_id, status);

-- 6. 創建自動歸檔函數 - 健康評估
CREATE OR REPLACE FUNCTION archive_patient_health_assessments(p_patient_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE health_assessments
  SET 
    status = 'archived',
    archived_at = now()
  WHERE 
    patient_id = p_patient_id 
    AND status = 'active';
END;
$$;

-- 7. 創建自動歸檔函數 - 傷口評估
CREATE OR REPLACE FUNCTION archive_patient_wound_assessments(p_patient_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE wound_assessments
  SET 
    status = 'archived',
    archived_at = now()
  WHERE 
    patient_id = p_patient_id 
    AND status = 'active';
END;
$$;

-- 8. 創建觸發器函數 - 健康評估自動歸檔
CREATE OR REPLACE FUNCTION trigger_archive_health_assessments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 只有當新記錄為 active 時才執行歸檔
  IF NEW.status = 'active' THEN
    -- 歸檔該院友的其他 active 記錄（排除當前新記錄）
    UPDATE health_assessments
    SET 
      status = 'archived',
      archived_at = now()
    WHERE 
      patient_id = NEW.patient_id 
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 9. 創建觸發器函數 - 傷口評估自動歸檔
CREATE OR REPLACE FUNCTION trigger_archive_wound_assessments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 只有當新記錄為 active 時才執行歸檔
  IF NEW.status = 'active' THEN
    -- 歸檔該院友的其他 active 記錄（排除當前新記錄）
    UPDATE wound_assessments
    SET 
      status = 'archived',
      archived_at = now()
    WHERE 
      patient_id = NEW.patient_id 
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 10. 為 health_assessments 表創建觸發器
DROP TRIGGER IF EXISTS auto_archive_health_assessments ON health_assessments;
CREATE TRIGGER auto_archive_health_assessments
  AFTER INSERT ON health_assessments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_archive_health_assessments();

-- 11. 為 wound_assessments 表創建觸發器
DROP TRIGGER IF EXISTS auto_archive_wound_assessments ON wound_assessments;
CREATE TRIGGER auto_archive_wound_assessments
  AFTER INSERT ON wound_assessments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_archive_wound_assessments();

-- 12. 添加註釋
COMMENT ON COLUMN health_assessments.status IS '評估狀態：active（生效中）、archived（已歸檔）';
COMMENT ON COLUMN health_assessments.archived_at IS '歸檔時間戳';
COMMENT ON COLUMN wound_assessments.status IS '評估狀態：active（生效中）、archived（已歸檔）';
COMMENT ON COLUMN wound_assessments.archived_at IS '歸檔時間戳';
COMMENT ON FUNCTION archive_patient_health_assessments IS '將指定院友的所有生效中健康評估歸檔';
COMMENT ON FUNCTION archive_patient_wound_assessments IS '將指定院友的所有生效中傷口評估歸檔';