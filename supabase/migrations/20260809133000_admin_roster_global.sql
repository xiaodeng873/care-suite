-- 行政排班全域化：行政班次設定不再分居住區，合併為 station_id = NULL（全域）一組
-- 每個班次名稱保留一筆（最早建立者），其餘分站重複列刪除
DELETE FROM station_shift_settings
WHERE position = '行政'
  AND station_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (shift_name) id
    FROM station_shift_settings
    WHERE position = '行政' AND station_id IS NOT NULL
    ORDER BY shift_name, created_at
  );

UPDATE station_shift_settings
SET station_id = NULL
WHERE position = '行政' AND station_id IS NOT NULL;
