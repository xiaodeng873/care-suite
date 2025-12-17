/*
  # 創建床位管理系統

  1. 新增表格
    - `stations` - 站點管理表
      - `id` (uuid, primary key)
      - `name` (text, 站點名稱)
      - `description` (text, 站點描述)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `beds` - 床位管理表
      - `id` (uuid, primary key)
      - `station_id` (uuid, foreign key to stations)
      - `bed_number` (text, 床位號碼)
      - `bed_name` (text, 床位名稱)
      - `is_occupied` (boolean, 是否被佔用)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. 更新院友主表
    - 新增 `station_id` 欄位
    - 新增 `bed_id` 欄位
    - 更新現有院友資料指向C站

  3. 安全性
    - 啟用 RLS
    - 新增適當的策略

  4. 索引
    - 為常用查詢欄位新增索引
*/

-- 創建站點表
CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 創建床位表
CREATE TABLE IF NOT EXISTS beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  bed_number text NOT NULL,
  bed_name text,
  is_occupied boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(station_id, bed_number)
);

-- 啟用 RLS
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;

-- 新增站點和床位欄位到院友主表
DO $$
BEGIN
  -- 新增 station_id 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'station_id'
  ) THEN
    ALTER TABLE "院友主表" ADD COLUMN station_id uuid REFERENCES stations(id);
  END IF;

  -- 新增 bed_id 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'bed_id'
  ) THEN
    ALTER TABLE "院友主表" ADD COLUMN bed_id uuid REFERENCES beds(id);
  END IF;
END $$;

-- 創建 RLS 策略
CREATE POLICY "Allow authenticated users to read stations"
  ON stations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage stations"
  ON stations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read beds"
  ON beds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage beds"
  ON beds
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_stations_name ON stations(name);
CREATE INDEX IF NOT EXISTS idx_beds_station_id ON beds(station_id);
CREATE INDEX IF NOT EXISTS idx_beds_bed_number ON beds(bed_number);
CREATE INDEX IF NOT EXISTS idx_beds_is_occupied ON beds(is_occupied);
CREATE INDEX IF NOT EXISTS idx_院友主表_station_id ON "院友主表"(station_id);
CREATE INDEX IF NOT EXISTS idx_院友主表_bed_id ON "院友主表"(bed_id);

-- 創建更新時間觸發器
CREATE OR REPLACE FUNCTION update_stations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_beds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stations_updated_at
  BEFORE UPDATE ON stations
  FOR EACH ROW
  EXECUTE FUNCTION update_stations_updated_at();

CREATE TRIGGER update_beds_updated_at
  BEFORE UPDATE ON beds
  FOR EACH ROW
  EXECUTE FUNCTION update_beds_updated_at();

-- 插入預設的C站
INSERT INTO stations (name, description) 
VALUES ('C站', '善頤福群護老院C站')
ON CONFLICT (name) DO NOTHING;

-- 為C站創建現有的床位（根據現有院友的床號）
DO $$
DECLARE
  c_station_id uuid;
  bed_record RECORD;
BEGIN
  -- 獲取C站的ID
  SELECT id INTO c_station_id FROM stations WHERE name = 'C站';
  
  -- 為每個現有的床號創建床位記錄
  FOR bed_record IN 
    SELECT DISTINCT "床號" FROM "院友主表" WHERE "床號" IS NOT NULL AND "床號" != ''
  LOOP
    INSERT INTO beds (station_id, bed_number, bed_name, is_occupied)
    VALUES (c_station_id, bed_record."床號", bed_record."床號", true)
    ON CONFLICT (station_id, bed_number) DO NOTHING;
  END LOOP;
  
  -- 更新院友主表，將現有院友指派到對應的床位和C站
  UPDATE "院友主表" 
  SET 
    station_id = c_station_id,
    bed_id = (
      SELECT b.id 
      FROM beds b 
      WHERE b.station_id = c_station_id 
      AND b.bed_number = "院友主表"."床號"
    )
  WHERE "床號" IS NOT NULL AND "床號" != '';
END $$;