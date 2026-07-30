-- 解決兩床暫時互換取消時互相困住的問題
-- 1. 修改 fn_end_temporary_transfer：偵測互相暫換（mutual_swap_detected）並回傳對方院友 ID。
-- 2. 新增 fn_end_temporary_swap_pair：成對取消互相暫換，讓兩人同時返回原床。
-- 3. 統一使用機器可讀 reason code（root_bed_occupied / mutual_swap_detected）。
-- 4. 授予 public 執行權限，配合前端 anon key 呼叫 RPC。

-- ─────────────────────────────────────────────
-- 1. 修改 fn_end_temporary_transfer
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_end_temporary_transfer(
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
  v_occupant "院友主表"%ROWTYPE;
  v_log_id uuid;
  v_actor_user_id uuid := CASE
    WHEN p_actor IS NULL OR p_actor->>'user_id' IS NULL OR p_actor->>'user_id' = '' THEN NULL
    ELSE (p_actor->>'user_id')::uuid
  END;
BEGIN
  SELECT * INTO v_patient FROM "院友主表" WHERE "院友id" = p_patient_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'patient_not_found');
  END IF;

  IF v_patient.bed_transfer_type IS DISTINCT FROM 'temporary' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_temporary_transfer');
  END IF;

  v_root_bed_id := v_patient.original_bed_id;
  IF v_root_bed_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_original_bed');
  END IF;

  SELECT bed_number, station_id INTO v_root_bed_number, v_root_station_id
  FROM beds WHERE id = v_root_bed_id;

  -- 檢查原床位是否被其他在住院友佔用
  SELECT * INTO v_occupant
  FROM "院友主表"
  WHERE bed_id = v_root_bed_id
    AND "院友id" <> p_patient_id
    AND 在住狀態 = '在住'
  LIMIT 1;

  IF FOUND THEN
    -- 互相暫換偵測：對方也處於暫時性調動，且雙方互佔對方原床位
    IF v_occupant.bed_transfer_type = 'temporary'
       AND v_occupant.original_bed_id IS NOT NULL
       AND v_occupant.original_bed_id = v_patient.bed_id
       AND v_occupant.bed_id = v_patient.original_bed_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'mutual_swap_detected',
        'partner_patient_id', v_occupant."院友id"
      );
    END IF;

    -- 原床位被佔用（非互相暫換）
    INSERT INTO bed_transfer_log (
      patient_id, from_bed_id, to_bed_id, from_bed_number, to_bed_number,
      action_type, transfer_subtype, notes,
      actor_user_id, actor_username, actor_name, actor_role, actor_department
    ) VALUES (
      p_patient_id, v_patient.bed_id, v_root_bed_id,
      v_patient.床號, v_root_bed_number,
      'cancel_temporary', 'failed_root_occupied',
      '原床位已被佔用，院友困在現床',
      v_actor_user_id,
      p_actor->>'username',
      p_actor->>'name',
      p_actor->>'role',
      p_actor->>'department'
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object('success', false, 'reason', 'root_bed_occupied', 'log_id', v_log_id);
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
    action_type, transfer_subtype,
    actor_user_id, actor_username, actor_name, actor_role, actor_department
  ) VALUES (
    p_patient_id, v_patient.bed_id, v_root_bed_id,
    v_patient.床號, v_root_bed_number,
    'cancel_temporary', 'completed',
    v_actor_user_id,
    p_actor->>'username',
    p_actor->>'name',
    p_actor->>'role',
    p_actor->>'department'
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object('success', true, 'log_id', v_log_id);
END;
$$;

COMMENT ON FUNCTION public.fn_end_temporary_transfer(integer, jsonb) IS
  '安全結束暫時調動：原床位未被佔用時返回原床；若與對方互相暫換則回傳 mutual_swap_detected。';

-- ─────────────────────────────────────────────
-- 2. 新增 fn_end_temporary_swap_pair
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_end_temporary_swap_pair(integer, integer, jsonb);

CREATE OR REPLACE FUNCTION public.fn_end_temporary_swap_pair(
  p_patient_id1 integer,
  p_patient_id2 integer,
  p_actor jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_p1 "院友主表"%ROWTYPE;
  v_p2 "院友主表"%ROWTYPE;
  v_bed1 beds%ROWTYPE;
  v_bed2 beds%ROWTYPE;
  v_group_id uuid := gen_random_uuid();
  v_actor_user_id uuid := CASE
    WHEN p_actor IS NULL OR p_actor->>'user_id' IS NULL OR p_actor->>'user_id' = '' THEN NULL
    ELSE (p_actor->>'user_id')::uuid
  END;
BEGIN
  SELECT * INTO v_p1 FROM "院友主表" WHERE "院友id" = p_patient_id1;
  SELECT * INTO v_p2 FROM "院友主表" WHERE "院友id" = p_patient_id2;

  IF NOT FOUND OR v_p2 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'patient_not_found');
  END IF;

  IF v_p1.bed_transfer_type IS DISTINCT FROM 'temporary'
     OR v_p2.bed_transfer_type IS DISTINCT FROM 'temporary' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_temporary_transfer');
  END IF;

  IF v_p1.original_bed_id IS NULL
     OR v_p2.original_bed_id IS NULL
     OR v_p1.original_bed_id <> v_p2.bed_id
     OR v_p2.original_bed_id <> v_p1.bed_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_mutual_swap');
  END IF;

  SELECT * INTO v_bed1 FROM beds WHERE id = v_p1.original_bed_id;
  SELECT * INTO v_bed2 FROM beds WHERE id = v_p2.original_bed_id;

  IF NOT FOUND OR v_bed2 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'original_bed_not_found');
  END IF;

  -- 同時把兩人調回各自原床
  UPDATE "院友主表"
  SET
    bed_id = v_p1.original_bed_id,
    station_id = v_bed1.station_id,
    床號 = v_bed1.bed_number,
    original_bed_id = v_p1.original_bed_id,
    original_station_id = v_bed1.station_id,
    bed_transfer_type = 'routine',
    temporary_transfer_started_at = NULL
  WHERE "院友id" = p_patient_id1;

  UPDATE "院友主表"
  SET
    bed_id = v_p2.original_bed_id,
    station_id = v_bed2.station_id,
    床號 = v_bed2.bed_number,
    original_bed_id = v_p2.original_bed_id,
    original_station_id = v_bed2.station_id,
    bed_transfer_type = 'routine',
    temporary_transfer_started_at = NULL
  WHERE "院友id" = p_patient_id2;

  -- 寫入兩筆日誌，同一 group_id
  INSERT INTO bed_transfer_log (
    patient_id, from_bed_id, to_bed_id, from_bed_number, to_bed_number,
    action_type, transfer_subtype, notes, group_id,
    actor_user_id, actor_username, actor_name, actor_role, actor_department
  ) VALUES (
    p_patient_id1, v_p1.bed_id, v_p1.original_bed_id,
    v_p1.床號, v_bed1.bed_number,
    'cancel_temporary', 'swap_pair', '成對取消暫時性互換', v_group_id,
    v_actor_user_id,
    p_actor->>'username',
    p_actor->>'name',
    p_actor->>'role',
    p_actor->>'department'
  );

  INSERT INTO bed_transfer_log (
    patient_id, from_bed_id, to_bed_id, from_bed_number, to_bed_number,
    action_type, transfer_subtype, notes, group_id,
    actor_user_id, actor_username, actor_name, actor_role, actor_department
  ) VALUES (
    p_patient_id2, v_p2.bed_id, v_p2.original_bed_id,
    v_p2.床號, v_bed2.bed_number,
    'cancel_temporary', 'swap_pair', '成對取消暫時性互換', v_group_id,
    v_actor_user_id,
    p_actor->>'username',
    p_actor->>'name',
    p_actor->>'role',
    p_actor->>'department'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.fn_end_temporary_swap_pair(integer, integer, jsonb) IS
  '成對取消兩位院友的互相暫時性調換，讓雙方同時返回原床位。';

-- ─────────────────────────────────────────────
-- 3. 授予執行權限（配合前端 anon key）
-- ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_end_temporary_transfer(integer, jsonb) TO public;
GRANT EXECUTE ON FUNCTION public.fn_end_temporary_swap_pair(integer, integer, jsonb) TO public;
