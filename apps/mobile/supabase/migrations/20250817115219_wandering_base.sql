/*
  # 清理床位關係並修正更新邏輯

  1. 清理現有資料
    - 釋放已退住和待入住院友佔用的床位
    - 清除這些院友的床位和站點關係
  2. 修正
    - 確保床位狀態與實際佔用情況一致
*/

-- 第一步：清理已退住院友的床位關係
UPDATE "院友主表" 
SET 
  station_id = NULL,
  bed_id = NULL,
  床號 = ''
WHERE 在住狀態 = '已退住' 
  AND (station_id IS NOT NULL OR bed_id IS NOT NULL OR 床號 != '');

-- 第二步：清理待入住院友的床位關係  
UPDATE "院友主表"
SET 
  station_id = NULL,
  bed_id = NULL,
  床號 = ''
WHERE 在住狀態 = '待入住'
  AND (station_id IS NOT NULL OR bed_id IS NOT NULL OR 床號 != '');

-- 第三步：釋放這些院友之前佔用的床位
UPDATE beds 
SET is_occupied = false 
WHERE id IN (
  SELECT DISTINCT bed_id 
  FROM "院友主表" 
  WHERE 在住狀態 IN ('已退住', '待入住') 
    AND bed_id IS NOT NULL
);

-- 第四步：修正床位佔用狀態 - 確保只有在住院友的床位標記為已佔用
UPDATE beds 
SET is_occupied = CASE 
  WHEN id IN (
    SELECT bed_id 
    FROM "院友主表" 
    WHERE 在住狀態 = '在住' 
      AND bed_id IS NOT NULL
  ) THEN true
  ELSE false
END;

-- 第五步：驗證清理結果
DO $$
DECLARE
  discharged_with_beds INTEGER;
  pending_with_beds INTEGER;
  occupied_beds_without_patients INTEGER;
BEGIN
  -- 檢查已退住院友是否還有床位關係
  SELECT COUNT(*) INTO discharged_with_beds
  FROM "院友主表" 
  WHERE 在住狀態 = '已退住' 
    AND (station_id IS NOT NULL OR bed_id IS NOT NULL OR 床號 != '');
  
  -- 檢查待入住院友是否還有床位關係
  SELECT COUNT(*) INTO pending_with_beds
  FROM "院友主表" 
  WHERE 在住狀態 = '待入住'
    AND (station_id IS NOT NULL OR bed_id IS NOT NULL OR 床號 != '');
  
  -- 檢查標記為已佔用但沒有在住院友的床位
  SELECT COUNT(*) INTO occupied_beds_without_patients
  FROM beds 
  WHERE is_occupied = true 
    AND id NOT IN (
      SELECT bed_id 
      FROM "院友主表" 
      WHERE 在住狀態 = '在住' 
        AND bed_id IS NOT NULL
    );
  
  -- 輸出清理結果
  RAISE NOTICE '清理結果統計:';
  RAISE NOTICE '- 仍有床位關係的已退住院友: %', discharged_with_beds;
  RAISE NOTICE '- 仍有床位關係的待入住院友: %', pending_with_beds;
  RAISE NOTICE '- 標記已佔用但無在住院友的床位: %', occupied_beds_without_patients;
  
  IF discharged_with_beds = 0 AND pending_with_beds = 0 AND occupied_beds_without_patients = 0 THEN
    RAISE NOTICE '✅ 床位關係清理完成，所有資料一致';
  ELSE
    RAISE NOTICE '⚠️ 仍有不一致的資料需要檢查';
  END IF;
END $$;