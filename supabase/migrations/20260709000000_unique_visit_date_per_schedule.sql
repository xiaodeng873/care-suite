/*
  # 每天只能有一個到診排程（全居住區共享）

  1. 變更
    - `到診排程主表` 新增 UNIQUE 約束於 `到診日期`
    - 去重保護：先合併同日重複排程（移院友細項至最舊排程，刪除多餘列）

  2. 業務邏輯
    - 所有居住區共用同一個到診日期排程
    - 院友可加入任何排程；站別過濾器僅控制顯示哪些院友
    - 唯一性由 DB 強制執行（避免前端多次提交產生重複）
*/

-- Step 1：去重（移動重複排程的院友細項至同日最舊的排程，再刪除重複列）
DO $$
DECLARE
  dup RECORD;
  keep_id INT;
  dup_id  INT;
BEGIN
  FOR dup IN
    SELECT 到診日期, array_agg(排程id ORDER BY 排程id) AS ids
    FROM "到診排程主表"
    GROUP BY 到診日期
    HAVING COUNT(*) > 1
  LOOP
    keep_id := dup.ids[1];
    FOR i IN 2 .. array_length(dup.ids, 1) LOOP
      dup_id := dup.ids[i];
      -- 把重複排程的院友細項改指向保留的排程
      UPDATE "看診院友細項" SET "排程id" = keep_id WHERE "排程id" = dup_id;
      -- 刪除重複排程主表列
      DELETE FROM "到診排程主表" WHERE "排程id" = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- Step 2：加 UNIQUE 約束
ALTER TABLE "到診排程主表"
  DROP CONSTRAINT IF EXISTS "到診排程主表_到診日期_unique";

ALTER TABLE "到診排程主表"
  ADD CONSTRAINT "到診排程主表_到診日期_unique" UNIQUE ("到診日期");
