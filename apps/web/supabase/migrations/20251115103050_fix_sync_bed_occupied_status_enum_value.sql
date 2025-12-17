/*
  # 修復床位佔用狀態同步觸發器的枚舉值錯誤

  修正 sync_bed_occupied_status() 函數中的在住狀態枚舉值
  - 將錯誤的 '在院' 改為正確的 '在住'
  - 這個錯誤導致新增院友時觸發器執行失敗，返回 400 錯誤
*/

CREATE OR REPLACE FUNCTION public.sync_bed_occupied_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE beds
  SET is_occupied = EXISTS (
    SELECT 1 FROM 院友主表
    WHERE 院友主表.床號 = beds.bed_number
    AND 院友主表.在住狀態 = '在住'
  );
  RETURN NEW;
END;
$function$;
