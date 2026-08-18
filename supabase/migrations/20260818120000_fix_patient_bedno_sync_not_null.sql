-- 修正 trg_patient_bedno_sync：當 bed_id 被清空時，唔好將 床號 設為 NULL，
-- 因為 院友主表.床號 係 NOT NULL，會引發 not-null constraint violation。
-- 只在 bed_id 指向真實床位時同步 床號；清空 bed_id 時保留原值。

CREATE OR REPLACE FUNCTION fn_patient_bedno_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_bed_number text;
BEGIN
  IF NEW.bed_id IS DISTINCT FROM OLD.bed_id THEN
    IF NEW.bed_id IS NOT NULL THEN
      SELECT bed_number INTO v_bed_number
      FROM beds
      WHERE id = NEW.bed_id;
      NEW.床號 := v_bed_number;
    END IF;
    -- 若 NEW.bed_id 變為 NULL，保留舊 床號，避免違反 NOT NULL 約束；
    -- 後續重新指派床位時會再由觸發器更新為正確 bed_number。
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
