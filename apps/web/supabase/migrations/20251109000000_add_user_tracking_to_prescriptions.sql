/*
  # 新增使用者追蹤欄位到處方表

  1. 新增內容
    - 新增 `created_by` 欄位到 `new_medication_prescriptions` 表
      - 記錄處方建立者的使用者 email 或 ID
      - 類型：text，允許為 NULL（處理歷史資料）

    - 新增 `last_modified_by` 欄位到 `new_medication_prescriptions` 表
      - 記錄最後修改處方的使用者 email 或 ID
      - 類型：text，允許為 NULL（處理歷史資料）

  2. 說明
    - 這些欄位用於追蹤處方的建立者和修改者
    - 用於個人藥物記錄匯出時的電子簽名欄位（I 欄）
    - 現有處方記錄的這些欄位將保持 NULL（歷史資料）
    - 新建立或修改的處方將自動填入當前使用者資訊

  3. 安全性
    - 欄位為文字類型，不涉及敏感資料加密
    - 現有 RLS 政策適用
    - 新增索引以提升查詢效能
*/

-- 新增 created_by 欄位（如不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE new_medication_prescriptions
    ADD COLUMN created_by text;

    RAISE NOTICE '已新增 created_by 欄位到 new_medication_prescriptions 表';
  ELSE
    RAISE NOTICE 'created_by 欄位已存在，跳過新增';
  END IF;
END $$;

-- 新增 last_modified_by 欄位（如不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'new_medication_prescriptions' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE new_medication_prescriptions
    ADD COLUMN last_modified_by text;

    RAISE NOTICE '已新增 last_modified_by 欄位到 new_medication_prescriptions 表';
  ELSE
    RAISE NOTICE 'last_modified_by 欄位已存在，跳過新增';
  END IF;
END $$;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_new_prescriptions_created_by
ON new_medication_prescriptions(created_by);

CREATE INDEX IF NOT EXISTS idx_new_prescriptions_last_modified_by
ON new_medication_prescriptions(last_modified_by);

-- 新增欄位註釋
COMMENT ON COLUMN new_medication_prescriptions.created_by IS '處方建立者的使用者識別（email 或 ID），用於審計追蹤';
COMMENT ON COLUMN new_medication_prescriptions.last_modified_by IS '最後修改處方的使用者識別（email 或 ID），用於個人藥物記錄的電子簽名欄位';
