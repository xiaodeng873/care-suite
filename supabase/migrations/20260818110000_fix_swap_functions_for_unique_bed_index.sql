-- 修正床位互換 function，避免部分唯一索引（在住院友 bed_id 唯一）
-- 在互換中途觸發 duplicate key violation。
-- 背景：swapPatientBeds 與 fn_end_temporary_swap_pair 用兩次 UPDATE 互換床號，
--       第一次 UPDATE 後兩位院友會短暫擁有相同 bed_id，觸發約束。

-- 1. 更新 fn_end_temporary_swap_pair：以 NULL 作為中間狀態安全互換
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

  -- 先把 patient1 的 bed_id 設為 NULL，避免互換中途違反唯一索引
  UPDATE "院友主表"
  SET bed_id = NULL
  WHERE "院友id" = p_patient_id1;

  -- 調回 patient2 到其原床
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

  -- 調回 patient1 到其原床
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
  '成對取消兩位院友的互相暫時性調換，以 NULL 中間狀態避免唯一索引衝突。';

GRANT EXECUTE ON FUNCTION public.fn_end_temporary_swap_pair(integer, integer, jsonb) TO public;
