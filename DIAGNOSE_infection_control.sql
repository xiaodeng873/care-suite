-- 診斷：感染控制資料去向
-- 在 Supabase SQL Editor 執行，把結果截圖或貼回給我

SELECT
  (SELECT COUNT(*) FROM "院友主表") AS 院友總數,
  (SELECT COUNT(*) FROM "院友主表" WHERE "感染控制" IS NOT NULL AND jsonb_array_length("感染控制") > 0) AS 舊欄位有資料的院友數,
  (SELECT COUNT(*) FROM "infection_control_records") AS 新表筆數;

-- 舊欄位還有資料的樣本（如果為 0，代表舊欄位已空）
SELECT "院友id", "中文姓名", "床號", "感染控制"
FROM "院友主表"
WHERE "感染控制" IS NOT NULL AND jsonb_array_length("感染控制") > 0
LIMIT 20;

-- 查看其他 JSONB 欄位是否含有「感染」字樣
SELECT "院友id", "中文姓名", "medical_history_json", "social_status_json", "medical_services_json"
FROM "院友主表"
WHERE "medical_history_json"::text ILIKE '%感染%'
   OR "social_status_json"::text ILIKE '%感染%'
   OR "medical_services_json"::text ILIKE '%感染%'
LIMIT 20;

-- 院友主表所有含「感染」字樣的欄位名稱
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = '院友主表' AND column_name ILIKE '