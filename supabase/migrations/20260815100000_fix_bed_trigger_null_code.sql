/*
  修復 beds BEFORE INSERT/UPDATE 觸發器：
  當居住區代號或房號缺失時，避免 NEW.bed_number 變成 NULL 導致 NOT NULL 約束錯誤，
  同時保留用戶提供/現有的 bed_number 作後備。

  背景：居住區代號（stations.code）為選填；若新增/編輯床位時 station.code 為空，
  舊觸發器會把 bed_number 設成 NULL，令 INSERT/UPDATE 失敗，
  表現為「無法新增床位」或「無法更新床位名稱」。
*/

CREATE OR REPLACE FUNCTION fn_bed_compose_number()
RETURNS TRIGGER AS $$
DECLARE
  v_code text;
  v_room text;
  v_station uuid;
BEGIN
  -- 只有在具備 room_id 與 bed_no 時才自動合成（保留手動 bed_number 作後備）
  IF NEW.room_id IS NOT NULL AND NEW.bed_no IS NOT NULL THEN
    SELECT s.code, r.room_number, r.station_id
      INTO v_code, v_room, v_station
    FROM rooms r
    JOIN stations s ON s.id = r.station_id
    WHERE r.id = NEW.room_id;

    -- 保持 station_id 與房間所屬居住區一致
    IF v_station IS NOT NULL THEN
      NEW.station_id := v_station;
    END IF;

    -- 正常合成：代號＋房號＋床號
    IF v_code IS NOT NULL AND v_room IS NOT NULL THEN
      NEW.bed_number := v_code || v_room || '-' || NEW.bed_no;
    -- 後備：缺少代號/房號時，避免 bed_number 變 NULL
    ELSIF NEW.bed_number IS NULL THEN
      NEW.bed_number := COALESCE(v_code, '') || COALESCE(v_room, '') || '-' || NEW.bed_no;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
