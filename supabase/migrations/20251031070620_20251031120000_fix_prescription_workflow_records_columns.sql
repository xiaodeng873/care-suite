/*
  # 修復 prescription_workflow_records 表欄位

  ## 說明
  將 dispensing_failure_custom_reason 重命名為 custom_failure_reason
  並添加缺失的 notes 欄位

  ## 變更內容
  1. 重命名欄位 dispensing_failure_custom_reason -> custom_failure_reason
  2. 添加 notes 欄位（如果不存在）
*/

-- 重命名欄位
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescription_workflow_records' 
    AND column_name = 'dispensing_failure_custom_reason'
  ) THEN
    ALTER TABLE prescription_workflow_records 
    RENAME COLUMN dispensing_failure_custom_reason TO custom_failure_reason;
  END IF;
END $$;

-- 添加 notes 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescription_workflow_records' AND column_name = 'notes'
  ) THEN
    ALTER TABLE prescription_workflow_records ADD COLUMN notes text;
  END IF;
END $$;