/*
  # 修復床位佔用狀態同步觸發器 - 添加 WHERE 條件

  問題: 
  - 原觸發器嘗試一次性更新所有床位，沒有 WHERE 條件
  - 某些資料庫配置禁止沒有 WHERE 條件的 UPDATE 語句
  
  解決方案:
  - 只更新與新增/更新/刪除院友相關的床位
  - 使用 NEW.床號 或 OLD.床號 作為 WHERE 條件
  - 處理 INSERT、UPDATE、DELETE 三種情況
*/

-- 刪除舊的觸發器（如果存在）
DROP TRIGGER IF EXISTS sync_bed_status_on_patient_insert ON "院友主表";
DROP TRIGGER IF EXISTS sync_bed_status_on_patient_update ON "院友主表";
DROP TRIGGER IF EXISTS sync_bed_status_on_patient_delete ON "院友主表";

-- 創建新的觸發器函數
CREATE OR REPLACE FUNCTION public.sync_bed_occupied_status_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  bed_numbers_to_update text[];
BEGIN
  -- 收集需要更新的床號
  IF TG_OP = 'INSERT' THEN
    bed_numbers_to_update := ARRAY[NEW.床號];
  ELSIF TG_OP = 'UPDATE' THEN
    -- 如果床號改變，需要更新舊床號和新床號
    IF OLD.床號 != NEW.床號 THEN
      bed_numbers_to_update := ARRAY[OLD.床號, NEW.床號];
    ELSE
      bed_numbers_to_update := ARRAY[NEW.床號];
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    bed_numbers_to_update := ARRAY[OLD.床號];
  END IF;

  -- 更新相關床位的佔用狀態
  IF bed_numbers_to_update IS NOT NULL THEN
    UPDATE beds
    SET is_occupied = EXISTS (
      SELECT 1 FROM "院友主表"
      WHERE "院友主表".床號 = beds.bed_number
      AND "院友主表".在住狀態 = '在住'
    )
    WHERE beds.bed_number = ANY(bed_numbers_to_update);
  END IF;

  -- 返回適當的記錄
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- 創建觸發器
CREATE TRIGGER sync_bed_status_on_patient_change
  AFTER INSERT OR UPDATE OR DELETE ON "院友主表"
  FOR EACH ROW
  EXECUTE FUNCTION sync_bed_occupied_status_v2();

-- 保留舊函數以防其他地方使用，但更新其邏輯為安全版本
CREATE OR REPLACE FUNCTION public.sync_bed_occupied_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- 使用新版本的邏輯
  RETURN sync_bed_occupied_status_v2();
END;
$function$;
