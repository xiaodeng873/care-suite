/*
  # 新增處方主表「需要時」欄位

  1. 資料表更新
    - 在 `處方主表` 新增 `需要時` 欄位 (boolean)
    - 預設值為 false (定服藥物)
  
  2. 說明
    - true: 藥物可以由護士決定院友之需要而派發
    - false: 此藥物為定服藥物
*/

-- 新增需要時欄位到處方主表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '處方主表' AND column_name = '需要時'
  ) THEN
    ALTER TABLE 處方主表 ADD COLUMN 需要時 BOOLEAN DEFAULT false;
  END IF;
END $$;