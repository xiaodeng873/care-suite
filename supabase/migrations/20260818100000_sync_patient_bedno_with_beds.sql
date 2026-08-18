-- 同步院友主表.床號與 beds.bed_number
-- 背景：部分畫面（dashboard、監測任務等）直接讀取院友主表.床號，
--       但此欄位為去正規化欄位，可能與 beds.bed_number 不一致，
--       導致床位管理頁面顯示正確，但其他畫面顯示錯誤床號。

-- 1. 一次性修正現有數據：把在住院友的 床號 更新為其實際床位的 bed_number
UPDATE "院友主表" p
SET 床號 = b.bed_number
FROM beds b
WHERE p.bed_id = b.id
  AND p.在住狀態 = '在住'
  AND p.床號 IS DISTINCT FROM b.bed_number;

-- 2. 建立觸發器：當院友主表.bed_id 變更時，自動同步 床號
CREATE OR REPLACE FUNCTION fn_patient_bedno_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_bed_number text;
BEGIN
  -- bed_id 變更時，重新取得對應 bed_number；清空 bed_id 時保留原 床號，
  -- 避免違反院友主表.床號 的 NOT NULL 約束。
  IF NEW.bed_id IS DISTINCT FROM OLD.bed_id THEN
    IF NEW.bed_id IS NOT NULL THEN
      SELECT bed_number INTO v_bed_number
      FROM beds
      WHERE id = NEW.bed_id;
      NEW.床號 := v_bed_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_bedno_sync ON "院友主表";

CREATE TRIGGER trg_patient_bedno_sync
  BEFORE UPDATE OF bed_id ON "院友主表"
  FOR EACH ROW
  EXECUTE FUNCTION fn_patient_bedno_sync();
