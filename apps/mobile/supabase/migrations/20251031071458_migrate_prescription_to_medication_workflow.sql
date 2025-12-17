/*
  # 整合 prescription_workflow_records 到 medication_workflow_records

  ## 說明
  將 prescription_workflow_records 表的資料遷移到 medication_workflow_records，
  然後刪除 prescription_workflow_records 表，統一使用 medication_workflow_records。

  ## 變更內容
  1. 遷移資料
    - 將 prescription_workflow_records 的 326 筆記錄複製到 medication_workflow_records

  2. 刪除舊表
    - 刪除 prescription_workflow_records 表及其相關約束和索引

  ## 注意事項
  - 此遷移會保留所有現有資料
  - 程式碼需要更新為使用 medication_workflow_records
  - 遷移完成後無法回復，請確保程式碼已更新
*/

-- 步驟 1: 將資料從 prescription_workflow_records 遷移到 medication_workflow_records
INSERT INTO medication_workflow_records (
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
)
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
FROM prescription_workflow_records
ON CONFLICT (id) DO NOTHING;

-- 步驟 2: 驗證資料遷移是否完成
DO $$
DECLARE
  source_count INTEGER;
  target_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO source_count FROM prescription_workflow_records;
  SELECT COUNT(*) INTO target_count FROM medication_workflow_records;
  
  IF target_count < source_count THEN
    RAISE EXCEPTION '資料遷移失敗: medication_workflow_records 的記錄數 (%) 少於 prescription_workflow_records (%)。', target_count, source_count;
  END IF;
  
  RAISE NOTICE '資料遷移成功: 已遷移 % 筆記錄。', source_count;
END $$;

-- 步驟 3: 刪除 prescription_workflow_records 表
DROP TABLE IF EXISTS prescription_workflow_records CASCADE;
