-- 為院友主表新增最後居住區與最後床位，用於退住/死亡後仍能依據最後床位歸屬統計

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'last_station_id'
  ) THEN
    ALTER TABLE "院友主表" ADD COLUMN last_station_id uuid REFERENCES stations(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'last_bed_id'
  ) THEN
    ALTER TABLE "院友主表" ADD COLUMN last_bed_id uuid REFERENCES beds(id);
  END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_院友主表_last_station_id ON "院友主表"(last_station_id);
CREATE INDEX IF NOT EXISTS idx_院友主表_last_bed_id ON "院友主表"(last_bed_id);

-- 回填：把目前已退住但仍有 station_id/bed_id 的院友，先記到 last_station_id / last_bed_id，再清空現有欄位
UPDATE "院友主表"
SET
  last_station_id = station_id,
  last_bed_id = bed_id,
  station_id = NULL,
  bed_id = NULL
WHERE 在住狀態 = '已退住'
  AND (station_id IS NOT NULL OR bed_id IS NOT NULL);
