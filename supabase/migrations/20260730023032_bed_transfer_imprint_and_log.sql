/*
  # 床位調動印記與調動日誌

  1. 擴充 院友主表
     - original_bed_id / original_station_id：院友的「根床位」
     - bed_transfer_type：routine（常規） / temporary（暫時）
     - temporary_transfer_started_at：暫時調動開始時間

  2. 新建 bed_transfer_log
     - 記錄所有床位變動：入住、退住、常規調動、暫時調動、互換、返回原床、
       取消暫時調動、更改原床位
     - 去正規化床號，避免床位刪除後無法顯示
     - group_id 用於綁定同一高階操作（如互換會產生兩筆）

  3. 安全性
     - bed_transfer_log 啟用 RLS，只允許 SELECT / INSERT（審計日誌不可竄改）

  4. 回填現有資料：所有在住院友視為常規，original_bed_id = bed_id
*/

-- ─────────────────────────────────────────────
-- 1. 擴充 院友主表
-- ─────────────────────────────────────────────
ALTER TABLE "院友主表" ADD COLUMN IF NOT EXISTS original_bed_id uuid REFERENCES beds(id);
ALTER TABLE "院友主表" ADD COLUMN IF NOT EXISTS original_station_id uuid REFERENCES stations(id);
ALTER TABLE "院友主表" ADD COLUMN IF NOT EXISTS bed_transfer_type text
  CHECK (bed_transfer_type IS NULL OR bed_transfer_type IN ('routine', 'temporary'));
ALTER TABLE "院友主表" ADD COLUMN IF NOT EXISTS temporary_transfer_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_院友主表_original_bed_id ON "院友主表"(original_bed_id);
CREATE INDEX IF NOT EXISTS idx_院友主表_original_station_id ON "院友主表"(original_station_id);
CREATE INDEX IF NOT EXISTS idx_院友主表_bed_transfer_type ON "院友主表"(bed_transfer_type);

COMMENT ON COLUMN "院友主表".original_bed_id IS '院友根床位（原床位）。常規調動時等於 bed_id；暫時調動時為原床位。';
COMMENT ON COLUMN "院友主表".original_station_id IS '根床位所屬居住區。';
COMMENT ON COLUMN "院友主表".bed_transfer_type IS '床位調動類型：routine=常規, temporary=暫時。';
COMMENT ON COLUMN "院友主表".temporary_transfer_started_at IS '暫時調動開始時間。';

-- ─────────────────────────────────────────────
-- 2. 新建 bed_transfer_log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bed_transfer_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  from_bed_id uuid REFERENCES beds(id) ON DELETE SET NULL,
  to_bed_id uuid REFERENCES beds(id) ON DELETE SET NULL,
  from_bed_number text,
  to_bed_number text,
  action_type text NOT NULL CHECK (action_type IN (
    'admission',                 -- 入住
    'discharge',                 -- 退住
    'routine_transfer',          -- 常規調動
    'temporary_transfer',        -- 暫時調動
    'swap',                      -- 互換
    'return',                    -- 結束暫時調動、返回原床
    'cancel_temporary',          -- 取消暫時調動標籤
    'original_bed_change'        -- 更改原床位（保留暫時標籤）
  )),
  transfer_subtype text,
  actor_user_id uuid,
  actor_username text,
  actor_name text,
  actor_role text,
  actor_department text,
  notes text,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bed_transfer_log_patient_id ON bed_transfer_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_bed_transfer_log_from_bed_id ON bed_transfer_log(from_bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_transfer_log_to_bed_id ON bed_transfer_log(to_bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_transfer_log_created_at ON bed_transfer_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bed_transfer_log_group_id ON bed_transfer_log(group_id);

COMMENT ON TABLE bed_transfer_log IS '床位調動日誌：記錄每位院友及每張床位的所有床位變動足跡';

ALTER TABLE bed_transfer_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view bed transfer log" ON bed_transfer_log;
CREATE POLICY "Authenticated users can view bed transfer log" ON bed_transfer_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert bed transfer log" ON bed_transfer_log;
CREATE POLICY "Authenticated users can insert bed transfer log" ON bed_transfer_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 3. 回填現有在住院友
-- ─────────────────────────────────────────────
UPDATE "院友主表"
SET
  original_bed_id = bed_id,
  original_station_id = station_id,
  bed_transfer_type = 'routine',
  temporary_transfer_started_at = NULL
WHERE 在住狀態 = '在住'
  AND bed_id IS NOT NULL
  AND (original_bed_id IS NULL OR bed_transfer_type IS NULL);

-- 確保 original_station_id 與 original_bed_id 一致（若 beds 存在）
UPDATE "院友主表" p
SET original_station_id = b.station_id
FROM beds b
WHERE p.original_bed_id = b.id
  AND (p.original_station_id IS DISTINCT FROM b.station_id);

-- ─────────────────────────────────────────────
-- 4. 輔助函式：安全結束暫時調動
--    只有在原床位未被佔用時才執行；返回成功與否及原因
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_end_temporary_transfer(
  p_patient_id integer,
  p_actor jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient "院友主表"%ROWTYPE;
  v_root_bed_id uuid;
  v_root_bed_number text;
  v_root_station_id uuid;
  v_occupied boolean;
  v_log_id uuid;
BEGIN
  SELECT * INTO v_patient FROM "院友主表" WHERE "院友id" = p_patient_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', '找不到院友');
  END IF;

  IF v_patient.bed_transfer_type IS DISTINCT FROM 'temporary' THEN
    RETURN jsonb_build_object('success', false, 'reason', '院友不處於暫時調動');
  END IF;

  v_root_bed_id := v_patient.original_bed_id;
  IF v_root_bed_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', '沒有原床位');
  END IF;

  SELECT bed_number, station_id INTO v_root_bed_number, v_root_station_id
  FROM beds WHERE id = v_root_bed_id;

  -- 檢查原床位是否被其他在住院友佔用
  SELECT EXISTS(
    SELECT 1 FROM "院友主表"
    WHERE bed_id = v_root_bed_id
      AND "院友id" <> p_patient_id
      AND 在住狀態 = '在住'
  ) INTO v_occupied;

  IF v_occupied THEN
    -- 記錄取消失敗（困在現床）
    INSERT INTO bed_transfer_log (
      patient_id, from_bed_id, to_bed_id, from_bed_number, to_bed_number,
      action_type, transfer_subtype, notes, actor_user_id, actor_username, actor_name, actor_role, actor_department
    ) VALUES (
      p_patient_id, v_patient.bed_id, v_root_bed_id,
      v_patient.床號, v_root_bed_number,
      'cancel_temporary', 'failed_root_occupied',
      '原床位已被佔用，院友困在現床',
      (p_actor->>'user_id')::uuid,
      p_actor->>'username',
      p_actor->>'name',
      p_actor->>'role',
      p_actor->>'department'
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object('success', false, 'reason', '原床位已被佔用', 'log_id', v_log_id);
  END IF;

  -- 執行返回原床
  UPDATE "院友主表"
  SET
    bed_id = v_root_bed_id,
    station_id = v_root_station_id,
    床號 = v_root_bed_number,
    original_bed_id = v_root_bed_id,
    original_station_id = v_root_station_id,
    bed_transfer_type = 'routine',
    temporary_transfer_started_at = NULL
  WHERE "院友id" = p_patient_id;

  INSERT INTO bed_transfer_log (
    patient_id, from_bed_id, to_bed_id, from_bed_number, to_bed_number,
    action_type, actor_user_id, actor_username, actor_name, actor_role, actor_department
  ) VALUES (
    p_patient_id, v_patient.bed_id, v_root_bed_id,
    v_patient.床號, v_root_bed_number,
    'cancel_temporary',
    (p_actor->>'user_id')::uuid,
    p_actor->>'username',
    p_actor->>'name',
    p_actor->>'role',
    p_actor->>'department'
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object('success', true, 'log_id', v_log_id);
END;
$$;

COMMENT ON FUNCTION fn_end_temporary_transfer(integer, jsonb) IS '安全結束暫時調動：原床位未被佔用時返回原床，並寫入日誌。';
