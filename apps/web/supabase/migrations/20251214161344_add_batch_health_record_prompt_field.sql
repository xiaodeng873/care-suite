/*
  # 新增批量健康記錄OCR Prompt欄位

  1. 修改表
    - 在 `user_ocr_prompts` 表中新增 `batch_health_record_prompt` 欄位
      - 類型：TEXT
      - 用於儲存用戶自訂的批量健康記錄OCR識別指令
      - 可為空（NULL）

  2. 說明
    - 此欄位用於批量健康記錄OCR功能
    - 使用者可以自訂AI識別手寫健康記錄表的指令
    - 包含時間標記解析規則（7A→07:00, 12N→12:00, 4P→16:00）
*/

-- 新增 batch_health_record_prompt 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_ocr_prompts' AND column_name = 'batch_health_record_prompt'
  ) THEN
    ALTER TABLE user_ocr_prompts ADD COLUMN batch_health_record_prompt TEXT;
  END IF;
END $$;
