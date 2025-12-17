/*
  # 修復床位佔用狀態同步問題

  1. 說明
    - 建立資料庫觸發器自動維護 beds.is_occupied 欄位
    - 當院友資料更新時,自動同步床位佔用狀態
    - 避免應用層手動管理導致的資料不一致

  2. 觸發器功能
    - 當院友指派/釋放床位時,自動更新床位的 is_occupied 狀態
    - 當院友退住時,自動釋放床位
    - 確保床位狀態始終與實際院友佔用情況一致

  3. 初始化
    - 執行一次性修復,同步所有現有床位的佔用狀態
*/

-- 建立函數:當院友資料變更時,自動更新床位佔用狀態
CREATE OR REPLACE FUNCTION sync_bed_occupied_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 處理 INSERT 或 UPDATE 情況
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- 如果院友有床位且在住,標記床位為已佔用
    IF NEW.bed_id IS NOT NULL AND NEW.在住狀態 = '在住' THEN
      UPDATE beds
      SET is_occupied = true
      WHERE id = NEW.bed_id;
    END IF;
    
    -- 如果院友退住,釋放床位
    IF NEW.在住狀態 = '已退住' AND OLD.bed_id IS NOT NULL THEN
      UPDATE beds
      SET is_occupied = false
      WHERE id = OLD.bed_id;
      
      -- 清除院友的床位資訊
      NEW.bed_id := NULL;
      NEW.station_id := NULL;
    END IF;
    
    -- 如果院友從一個床位遷移到另一個床位
    IF TG_OP = 'UPDATE' AND OLD.bed_id IS NOT NULL AND NEW.bed_id != OLD.bed_id THEN
      -- 釋放舊床位
      UPDATE beds
      SET is_occupied = false
      WHERE id = OLD.bed_id;
    END IF;
  END IF;
  
  -- 處理 DELETE 情況
  IF TG_OP = 'DELETE' THEN
    -- 釋放被刪除院友的床位
    IF OLD.bed_id IS NOT NULL THEN
      UPDATE beds
      SET is_occupied = false
      WHERE id = OLD.bed_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 刪除舊觸發器(如果存在)
DROP TRIGGER IF EXISTS trigger_sync_bed_occupied_status ON 院友主表;

-- 建立觸發器
CREATE TRIGGER trigger_sync_bed_occupied_status
AFTER INSERT OR UPDATE OR DELETE ON 院友主表
FOR EACH ROW
EXECUTE FUNCTION sync_bed_occupied_status();

-- 建立函數:定期檢查並修復床位佔用狀態不一致的問題
CREATE OR REPLACE FUNCTION fix_bed_occupied_status()
RETURNS void AS $$
BEGIN
  -- 更新所有床位的佔用狀態,使其與實際院友指派一致
  UPDATE beds
  SET is_occupied = (
    SELECT COUNT(*) > 0
    FROM 院友主表 p
    WHERE p.bed_id = beds.id AND p.在住狀態 = '在住'
  );
END;
$$ LANGUAGE plpgsql;

-- 執行一次性修復,同步所有現有床位的佔用狀態
SELECT fix_bed_occupied_status();
