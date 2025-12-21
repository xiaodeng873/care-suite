/*
  # 擴展 patient_care_tabs 表支持選項卡啟用日期追蹤

  1. 新增欄位
    - `last_activated_at` (timestamptz) - 最後啟用時間，用於紅點補錄邏輯的日期範圍計算

  2. 新增觸發器
    - 當 is_hidden 從 true 變為 false 時，自動更新 last_activated_at 為當前時間

  3. 更新現有數據
    - 將所有現有記錄的 last_activated_at 設為其 created_at 值

  4. 更新約束
    - 將 'hygiene' 添加到 tab_type 的 CHECK 約束中
*/

-- 1. 添加 last_activated_at 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patient_care_tabs' 
    AND column_name = 'last_activated_at'
  ) THEN
    ALTER TABLE patient_care_tabs 
    ADD COLUMN last_activated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 2. 更新現有記錄的 last_activated_at 為其 created_at
UPDATE patient_care_tabs 
SET last_activated_at = created_at 
WHERE last_activated_at IS NULL;

-- 3. 創建觸發器函數：當選項卡重新啟用時更新 last_activated_at
CREATE OR REPLACE FUNCTION update_last_activated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- 當 is_hidden 從 true 變為 false 時，更新 last_activated_at
  IF OLD.is_hidden = true AND NEW.is_hidden = false THEN
    NEW.last_activated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 創建觸發器
DROP TRIGGER IF EXISTS trigger_update_last_activated_at ON patient_care_tabs;
CREATE TRIGGER trigger_update_last_activated_at
  BEFORE UPDATE ON patient_care_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_last_activated_at();

-- 5. 更新 tab_type 的 CHECK 約束以包含 'hygiene'
ALTER TABLE patient_care_tabs 
  DROP CONSTRAINT IF EXISTS patient_care_tabs_tab_type_check;

ALTER TABLE patient_care_tabs 
  ADD CONSTRAINT patient_care_tabs_tab_type_check 
  CHECK (tab_type IN ('patrol', 'diaper', 'intake_output', 'restraint', 'position', 'toilet_training', 'hygiene'));

-- 6. 添加註釋
COMMENT ON COLUMN patient_care_tabs.last_activated_at IS '選項卡最後啟用時間，用於計算紅點補錄的起始日期。當選項卡從隱藏狀態恢復時自動更新為當前時間。';
