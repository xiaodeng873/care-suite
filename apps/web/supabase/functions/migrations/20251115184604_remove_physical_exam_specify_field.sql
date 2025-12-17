/*
  # 移除身體檢查「請註明」欄位

  1. 變更
    - 刪除 `physical_exam_specify` 欄位

  2. 說明
    - 用戶要求移除第三部分「身體檢查」中的「請註明：」欄位
    - 此欄位不再需要，直接刪除
*/

-- 移除 physical_exam_specify 欄位
ALTER TABLE annual_health_checkups
  DROP COLUMN IF EXISTS physical_exam_specify;
