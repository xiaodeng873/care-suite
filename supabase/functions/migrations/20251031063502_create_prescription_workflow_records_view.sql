/*
  # 創建 prescription_workflow_records 視圖
  
  ## 說明
  創建一個視圖將 medication_workflow_records 表映射為 prescription_workflow_records，
  使代碼可以繼續使用 prescription_workflow_records 名稱而無需修改。
  
  ## 變更內容
  1. 創建視圖 prescription_workflow_records
  2. 映射所有欄位
*/

-- 創建視圖
CREATE OR REPLACE VIEW prescription_workflow_records AS
SELECT 
  id,
  prescription_id,
  patient_id,
  scheduled_date,
  scheduled_time,
  preparation_status,
  verification_status,
  dispensing_status,
  preparation_staff,
  verification_staff,
  dispensing_staff,
  preparation_time,
  verification_time,
  dispensing_time,
  dispensing_failure_reason,
  custom_failure_reason,
  notes,
  inspection_check_result,
  created_at,
  updated_at
FROM medication_workflow_records;

-- 創建 INSTEAD OF 觸發器函數來處理 INSERT
CREATE OR REPLACE FUNCTION prescription_workflow_records_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO medication_workflow_records (
    id, prescription_id, patient_id, scheduled_date, scheduled_time,
    preparation_status, verification_status, dispensing_status,
    preparation_staff, verification_staff, dispensing_staff,
    preparation_time, verification_time, dispensing_time,
    dispensing_failure_reason, custom_failure_reason, notes,
    inspection_check_result, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.prescription_id, NEW.patient_id, NEW.scheduled_date, NEW.scheduled_time,
    NEW.preparation_status, NEW.verification_status, NEW.dispensing_status,
    NEW.preparation_staff, NEW.verification_staff, NEW.dispensing_staff,
    NEW.preparation_time, NEW.verification_time, NEW.dispensing_time,
    NEW.dispensing_failure_reason, NEW.custom_failure_reason, NEW.notes,
    NEW.inspection_check_result, NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建 INSTEAD OF 觸發器函數來處理 UPDATE
CREATE OR REPLACE FUNCTION prescription_workflow_records_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE medication_workflow_records
  SET
    prescription_id = NEW.prescription_id,
    patient_id = NEW.patient_id,
    scheduled_date = NEW.scheduled_date,
    scheduled_time = NEW.scheduled_time,
    preparation_status = NEW.preparation_status,
    verification_status = NEW.verification_status,
    dispensing_status = NEW.dispensing_status,
    preparation_staff = NEW.preparation_staff,
    verification_staff = NEW.verification_staff,
    dispensing_staff = NEW.dispensing_staff,
    preparation_time = NEW.preparation_time,
    verification_time = NEW.verification_time,
    dispensing_time = NEW.dispensing_time,
    dispensing_failure_reason = NEW.dispensing_failure_reason,
    custom_failure_reason = NEW.custom_failure_reason,
    notes = NEW.notes,
    inspection_check_result = NEW.inspection_check_result,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建 INSTEAD OF 觸發器函數來處理 DELETE
CREATE OR REPLACE FUNCTION prescription_workflow_records_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM medication_workflow_records WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS prescription_workflow_records_insert_trigger ON prescription_workflow_records;
CREATE TRIGGER prescription_workflow_records_insert_trigger
  INSTEAD OF INSERT ON prescription_workflow_records
  FOR EACH ROW
  EXECUTE FUNCTION prescription_workflow_records_insert();

DROP TRIGGER IF EXISTS prescription_workflow_records_update_trigger ON prescription_workflow_records;
CREATE TRIGGER prescription_workflow_records_update_trigger
  INSTEAD OF UPDATE ON prescription_workflow_records
  FOR EACH ROW
  EXECUTE FUNCTION prescription_workflow_records_update();

DROP TRIGGER IF EXISTS prescription_workflow_records_delete_trigger ON prescription_workflow_records;
CREATE TRIGGER prescription_workflow_records_delete_trigger
  INSTEAD OF DELETE ON prescription_workflow_records
  FOR EACH ROW
  EXECUTE FUNCTION prescription_workflow_records_delete();
