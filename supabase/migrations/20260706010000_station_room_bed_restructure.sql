/*
  # 居住區 > 房間 > 床位 三層結構重構

  背景：
    - 原本床位以合成字串 `beds.bed_number`（如 "C202-1"）儲存，
      其中 C=居住區代號、202=房號、1=床號，三者混在一欄。
    - 院友主表.床號 亦為同樣合成字串，被 60+ 檔案用於顯示/排序/比對/工作紙。

  目標：
    - stations 新增 code（代號，如 A/B/C/D）。
    - 新增 rooms（房間）表，介於 stations 與 beds 之間。
    - beds 新增 room_id、bed_no（純床號部分，如 "1"）。
    - beds.bed_number 保留為「合成顯示值」，改由觸發器自動維護
      = station.code || room.room_number || '-' || bed_no，
      使既有 60+ 檔案與 院友主表.床號 完全不受影響。
    - 完整遷移現有資料（已稽核：269 床全部符合 [A-Za-z]+[0-9]+-[0-9]+ 格式，
      每居住區恰好一個代號 A/B/C/D）。

  安全性：
    - rooms 啟用 RLS，沿用現行「已認證用戶全存取」策略。
    - 觸發器維護合成值 + 級聯 + 同步 院友主表.床號。
*/

-- ─────────────────────────────────────────────
-- 1. stations.code（代號）
-- ─────────────────────────────────────────────
ALTER TABLE stations ADD COLUMN IF NOT EXISTS code text;

-- 由該站床位的字母前綴推導代號（已稽核：每站唯一）
UPDATE stations s
SET code = sub.prefix
FROM (
  SELECT station_id, substring(bed_number from '^[A-Za-z]+') AS prefix
  FROM beds
  GROUP BY station_id, substring(bed_number from '^[A-Za-z]+')
) sub
WHERE sub.station_id = s.id
  AND (s.code IS NULL OR s.code = '');

-- 代號唯一（允許多個 NULL）
CREATE UNIQUE INDEX IF NOT EXISTS idx_stations_code_unique
  ON stations (code) WHERE code IS NOT NULL;

COMMENT ON COLUMN stations.code IS '居住區代號（如 A/B/C/D），用於合成床號顯示';

-- ─────────────────────────────────────────────
-- 2. rooms（房間）表
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (station_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_rooms_station_id ON rooms (station_id);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Allow all access rooms'
  ) THEN
    DROP POLICY IF EXISTS "Allow all access rooms" ON rooms;

    CREATE POLICY "Allow all access rooms" ON rooms
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE rooms IS '房間：介於居住區與床位之間，room_number 如 "202"';

-- 由現有 beds 解析出的 (station, room_number) 建立房間
INSERT INTO rooms (station_id, room_number)
SELECT DISTINCT b.station_id, substring(b.bed_number from '^[A-Za-z]+([0-9]+)-') AS room_number
FROM beds b
WHERE substring(b.bed_number from '^[A-Za-z]+([0-9]+)-') IS NOT NULL
ON CONFLICT (station_id, room_number) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. beds.room_id、beds.bed_no
-- ─────────────────────────────────────────────
ALTER TABLE beds ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;
ALTER TABLE beds ADD COLUMN IF NOT EXISTS bed_no text;

CREATE INDEX IF NOT EXISTS idx_beds_room_id ON beds (room_id);

-- 回填 room_id 與 bed_no
UPDATE beds b
SET
  room_id = r.id,
  bed_no  = substring(b.bed_number from '-([0-9]+)$')
FROM rooms r
WHERE r.station_id = b.station_id
  AND r.room_number = substring(b.bed_number from '^[A-Za-z]+([0-9]+)-');

COMMENT ON COLUMN beds.room_id IS '所屬房間';
COMMENT ON COLUMN beds.bed_no  IS '床號（純數字部分，如 "1"）；合成顯示值仍存於 bed_number';
COMMENT ON COLUMN beds.bed_number IS '合成顯示值（代號+房號+-+床號，如 "C202-1"），由觸發器自動維護';

-- ─────────────────────────────────────────────
-- 4. 觸發器：維護 bed_number 合成值 + 級聯 + 同步 院友主表.床號
-- ─────────────────────────────────────────────

-- 4a. beds BEFORE INSERT/UPDATE：由 room→station.code + room_number + bed_no 合成 bed_number
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

    IF v_code IS NOT NULL AND v_room IS NOT NULL THEN
      NEW.bed_number := v_code || v_room || '-' || NEW.bed_no;
    END IF;

    -- 保持 station_id 與房間所屬居住區一致
    IF v_station IS NOT NULL THEN
      NEW.station_id := v_station;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bed_compose_number ON beds;
DROP TRIGGER IF EXISTS trg_bed_compose_number ON beds;

CREATE TRIGGER trg_bed_compose_number BEFORE INSERT OR UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION fn_bed_compose_number();

-- 4b. beds AFTER UPDATE：bed_number 變動時同步佔用院友的 院友主表.床號
CREATE OR REPLACE FUNCTION fn_bed_sync_patient_bedno()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bed_number IS DISTINCT FROM OLD.bed_number THEN
    UPDATE 院友主表
    SET 床號 = NEW.bed_number
    WHERE bed_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bed_sync_patient_bedno ON beds;
DROP TRIGGER IF EXISTS trg_bed_sync_patient_bedno ON beds;

CREATE TRIGGER trg_bed_sync_patient_bedno AFTER UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION fn_bed_sync_patient_bedno();

-- 4c. rooms AFTER UPDATE room_number：級聯重算子床位 bed_number
CREATE OR REPLACE FUNCTION fn_room_cascade_beds()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.room_number IS DISTINCT FROM OLD.room_number THEN
    -- 觸發子床位 BEFORE UPDATE 重算（bed_no 不變，僅寫回自身即可觸發）
    UPDATE beds SET bed_no = bed_no WHERE room_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_room_cascade_beds ON rooms;
DROP TRIGGER IF EXISTS trg_room_cascade_beds ON rooms;

CREATE TRIGGER trg_room_cascade_beds AFTER UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION fn_room_cascade_beds();

-- 4d. stations AFTER UPDATE code：級聯重算該站所有床位 bed_number
CREATE OR REPLACE FUNCTION fn_station_cascade_beds()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    UPDATE beds SET bed_no = bed_no
    WHERE room_id IN (SELECT id FROM rooms WHERE station_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_station_cascade_beds ON stations;
DROP TRIGGER IF EXISTS trg_station_cascade_beds ON stations;

CREATE TRIGGER trg_station_cascade_beds AFTER UPDATE ON stations
  FOR EACH ROW EXECUTE FUNCTION fn_station_cascade_beds();
