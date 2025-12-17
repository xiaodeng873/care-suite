/*
  # 新增院友照片欄位

  1. 資料表更新
    - 在 `院友主表` 新增 `院友相片` 欄位
  
  2. 安全設定
    - 更新現有的 RLS 政策以包含新欄位
*/

-- 新增院友相片欄位到院友主表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '院友相片'
  ) THEN
    ALTER TABLE 院友主表 ADD COLUMN 院友相片 TEXT;
  END IF;
END $$;