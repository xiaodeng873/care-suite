/*
  # 添加傷口痊癒狀態欄位

  ## 變更說明
  為 `wound_assessments` 表添加評估狀態和歸檔欄位，支持傷口痊癒追蹤和自動歸檔功能。

  ## 1. 新增欄位
    - `assessment_status` (text): 評估狀態，可選值為 'active'(進行中)、'improved'(改善中)、'healed'(已痊癒)
    - `is_archived` (boolean): 歸檔標記，當傷口痊癒且評估完成後自動設置為 true
    - `archived_at` (timestamptz): 歸檔時間戳記

  ## 2. 業務邏輯
    - 預設所有評估為 'active' 狀態
    - 當評估標記為 'healed' 且存在下次評估日期時，可以自動歸檔
    - 歸檔的記錄可以透過篩選器顯示/隱藏

  ## 3. 安全性
    - 使用 RLS 策略控制訪問
    - 已認證用戶可以更新評估狀態
*/

-- ============================================
-- 1. 添加新欄位到 wound_assessments 表
-- ============================================

DO $$
BEGIN
  -- 添加 assessment_status 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments'
    AND column_name = 'assessment_status'
  ) THEN
    ALTER TABLE wound_assessments
    ADD COLUMN assessment_status text DEFAULT 'active'
    CHECK (assessment_status IN ('active', 'improved', 'healed'));

    COMMENT ON COLUMN wound_assessments.assessment_status IS '評估狀態: active(進行中), improved(改善中), healed(已痊癒)';
  END IF;

  -- 添加 is_archived 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments'
    AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE wound_assessments
    ADD COLUMN is_archived boolean DEFAULT false;

    COMMENT ON COLUMN wound_assessments.is_archived IS '歸檔標記: true 表示已歸檔';
  END IF;

  -- 添加 archived_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wound_assessments'
    AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE wound_assessments
    ADD COLUMN archived_at timestamptz;

    COMMENT ON COLUMN wound_assessments.archived_at IS '歸檔時間戳記';
  END IF;
END $$;

-- ============================================
-- 2. 創建索引以提升查詢效能
-- ============================================

-- 為評估狀態創建索引
CREATE INDEX IF NOT EXISTS idx_wound_assessments_assessment_status
ON wound_assessments(assessment_status);

-- 為歸檔狀態創建索引
CREATE INDEX IF NOT EXISTS idx_wound_assessments_is_archived
ON wound_assessments(is_archived);

-- 為歸檔時間創建索引
CREATE INDEX IF NOT EXISTS idx_wound_assessments_archived_at
ON wound_assessments(archived_at);

-- 組合索引：狀態 + 歸檔標記（常見查詢組合）
CREATE INDEX IF NOT EXISTS idx_wound_assessments_status_archived
ON wound_assessments(assessment_status, is_archived);

-- ============================================
-- 3. 創建自動歸檔觸發器
-- ============================================

-- 創建觸發器函數：當評估標記為 healed 時自動設置歸檔時間
CREATE OR REPLACE FUNCTION auto_archive_healed_wound_assessment()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果評估狀態變更為 'healed' 且未歸檔，則設置歸檔標記和時間
  IF NEW.assessment_status = 'healed' AND NEW.is_archived = false THEN
    NEW.is_archived := true;
    NEW.archived_at := now();
  END IF;

  -- 如果評估狀態從 'healed' 變更為其他狀態，則移除歸檔標記
  IF OLD.assessment_status = 'healed' AND NEW.assessment_status <> 'healed' THEN
    NEW.is_archived := false;
    NEW.archived_at := null;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 創建觸發器
DROP TRIGGER IF EXISTS trigger_auto_archive_healed_wound ON wound_assessments;
CREATE TRIGGER trigger_auto_archive_healed_wound
  BEFORE UPDATE ON wound_assessments
  FOR EACH ROW
  EXECUTE FUNCTION auto_archive_healed_wound_assessment();

-- ============================================
-- 4. 更新現有記錄的預設值
-- ============================================

-- 將所有現有記錄設置為 active 狀態（如果尚未設置）
UPDATE wound_assessments
SET assessment_status = 'active'
WHERE assessment_status IS NULL;

-- 確保所有記錄都有歸檔標記（預設為 false）
UPDATE wound_assessments
SET is_archived = false
WHERE is_archived IS NULL;