/*
  # 新增感染控制欄位到院友主表

  1. 資料表更新
    - 在 `院友主表` 新增 `感染控制` 欄位 (jsonb)
    - 預設值為空陣列 []
  
  2. 索引
    - 新增 GIN 索引以提升 JSON 查詢效能
  
  3. 說明
    - 感染控制欄位用於記錄院友的感染控制相關資訊
    - 使用 JSON 陣列格式，與藥物敏感和不良藥物反應欄位一致
*/

-- 新增感染控制欄位到院友主表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '感染控制'
  ) THEN
    ALTER TABLE "院友主表" ADD COLUMN "感染控制" jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 新增索引以提升JSON查詢效能
CREATE INDEX IF NOT EXISTS "idx_院友主表_感染控制" ON "院友主表" USING gin ("感染控制");