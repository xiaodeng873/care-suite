/*
  # 診斷記錄欄位調整

  ## 變更內容
  - `diagnosis_date` 改為 `text`，允許儲存「不詳」
  - `diagnosis_unit` 保留 `text` 欄位，UI 不再強制輸入（空字串即可）
  - 將現有所有 `diagnosis_date` 更新為「不詳」
*/

ALTER TABLE diagnosis_records
  ALTER COLUMN diagnosis_unit SET DEFAULT '',
  ALTER COLUMN diagnosis_date TYPE text USING diagnosis_date::text,
  ALTER COLUMN diagnosis_date SET DEFAULT '不詳',
  ALTER COLUMN diagnosis_date SET NOT NULL;

UPDATE diagnosis_records SET diagnosis_date = '不詳';
