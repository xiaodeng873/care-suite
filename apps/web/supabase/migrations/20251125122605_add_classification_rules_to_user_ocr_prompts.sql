/*
  # 新增分類規則欄位到用戶 OCR Prompt 表

  1. 修改
    - 在 `user_ocr_prompts` 表新增 `classification_rules` 欄位
    - 此欄位用於儲存用戶自訂的文件分類規則
    - AI 會根據此規則判斷文件類型

  2. 欄位說明
    - `classification_rules` (text, nullable): 儲存用戶自訂的分類規則 Prompt
    - 如果為 null 或空字串，系統將使用預設的分類規則
*/

-- 新增 classification_rules 欄位
ALTER TABLE user_ocr_prompts
ADD COLUMN IF NOT EXISTS classification_rules TEXT;

-- 新增註解說明欄位用途
COMMENT ON COLUMN user_ocr_prompts.classification_rules IS 'AI文件分類規則，用於判斷文件類型（疫苗、覆診、診斷、處方等）';
