/*
  # 新增服用時間欄位和JSON欄位更新

  1. 資料庫變更
    - 在處方主表新增服用時間欄位（JSON陣列）
    - 將院友主表的藥物敏感和不良藥物反應改為JSON陣列
  
  2. 資料遷移
    - 將現有的文字資料轉換為JSON陣列格式
    
  3. 安全性
    - 維持現有的RLS政策
*/

-- 新增服用時間欄位到處方主表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '處方主表' AND column_name = '服用時間'
  ) THEN
    ALTER TABLE "處方主表" ADD COLUMN "服用時間" jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 將院友主表的藥物敏感欄位改為JSON陣列
DO $$
BEGIN
  -- 先備份現有資料並轉換為JSON陣列
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '藥物敏感' AND data_type = 'text'
  ) THEN
    -- 新增臨時欄位
    ALTER TABLE "院友主表" ADD COLUMN "藥物敏感_new" jsonb DEFAULT '[]'::jsonb;
    
    -- 轉換現有資料
    UPDATE "院友主表" 
    SET "藥物敏感_new" = CASE 
      WHEN "藥物敏感" IS NULL OR "藥物敏感" = '' OR "藥物敏感" = '無' THEN '[]'::jsonb
      ELSE jsonb_build_array("藥物敏感")
    END;
    
    -- 刪除舊欄位並重命名新欄位
    ALTER TABLE "院友主表" DROP COLUMN "藥物敏感";
    ALTER TABLE "院友主表" RENAME COLUMN "藥物敏感_new" TO "藥物敏感";
  END IF;
END $$;

-- 將院友主表的不良藥物反應欄位改為JSON陣列
DO $$
BEGIN
  -- 先備份現有資料並轉換為JSON陣列
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '不良藥物反應' AND data_type = 'text'
  ) THEN
    -- 新增臨時欄位
    ALTER TABLE "院友主表" ADD COLUMN "不良藥物反應_new" jsonb DEFAULT '[]'::jsonb;
    
    -- 轉換現有資料
    UPDATE "院友主表" 
    SET "不良藥物反應_new" = CASE 
      WHEN "不良藥物反應" IS NULL OR "不良藥物反應" = '' OR "不良藥物反應" = '無' THEN '[]'::jsonb
      ELSE jsonb_build_array("不良藥物反應")
    END;
    
    -- 刪除舊欄位並重命名新欄位
    ALTER TABLE "院友主表" DROP COLUMN "不良藥物反應";
    ALTER TABLE "院友主表" RENAME COLUMN "不良藥物反應_new" TO "不良藥物反應";
  END IF;
END $$;

-- 新增索引以提升JSON查詢效能
CREATE INDEX IF NOT EXISTS "idx_處方主表_服用時間" ON "處方主表" USING gin ("服用時間");
CREATE INDEX IF NOT EXISTS "idx_院友主表_藥物敏感" ON "院友主表" USING gin ("藥物敏感");
CREATE INDEX IF NOT EXISTS "idx_院友主表_不良藥物反應" ON "院友主表" USING gin ("不良藥物反應");