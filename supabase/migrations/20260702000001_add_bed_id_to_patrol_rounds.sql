-- 巡房記錄改以床位為主：新增 bed_id 欄位，patient_id 改為可空
-- Patrol rounds are now primarily bed-based; patient_id becomes nullable for empty beds

-- 1. 新增 bed_id 欄位（可空，外鍵關聯 beds 表）
ALTER TABLE patrol_rounds
  ADD COLUMN IF NOT EXISTS bed_id uuid REFERENCES beds(id) ON DELETE SET NULL;

-- 2. 回填 bed_id：用院友目前的床位補填歷史記錄
UPDATE patrol_rounds pr
SET bed_id = p.bed_id
FROM "院友主表" p
WHERE pr.patient_id = p."院友id"
  AND p.bed_id IS NOT NULL
  AND pr.bed_id IS NULL;

-- 3. patient_id 改為可空（空床巡房時 patient_id 為 null）
ALTER TABLE patrol_rounds
  ALTER COLUMN patient_id DROP NOT NULL;

-- 4. 新增 bed_id 索引，加速護理員頁按床位查詢
CREATE INDEX IF NOT EXISTS idx_patrol_rounds_bed_id ON patrol_rounds(bed_id);
