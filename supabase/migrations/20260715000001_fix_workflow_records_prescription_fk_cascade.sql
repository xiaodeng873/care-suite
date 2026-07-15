/*
  # 修復工作流程記錄外來鍵：改為指向 new_medication_prescriptions 並啟用 CASCADE

  ## 問題
  - 原有 FK fk_medication_workflow_prescription 指向已廢棄的 medication_prescriptions 表
  - 處方從 new_medication_prescriptions 刪除後，medication_workflow_records 的孤兒記錄
    不會被自動清除，導致主畫面逾期提醒永遠不消失

  ## 變更
  1. 移除舊的 FK 約束（指向廢棄表）
  2. 清理孤兒記錄（prescription_id 已不存在於 new_medication_prescriptions 的記錄）
  3. 新增正確 FK，指向 new_medication_prescriptions，並設定 ON DELETE CASCADE
     → 之後刪除處方時，其所有工作流程記錄會自動連帶刪除
*/

-- 1. 移除舊的外來鍵約束
ALTER TABLE medication_workflow_records
  DROP CONSTRAINT IF EXISTS fk_medication_workflow_prescription;

-- 2. 清理孤兒記錄（對應處方已不存在）
DELETE FROM medication_workflow_records
WHERE prescription_id NOT IN (
  SELECT id FROM new_medication_prescriptions
);

-- 3. 新增正確的外來鍵約束（指向 new_medication_prescriptions，CASCADE 刪除）
ALTER TABLE medication_workflow_records
  ADD CONSTRAINT fk_medication_workflow_prescription
  FOREIGN KEY (prescription_id)
  REFERENCES new_medication_prescriptions(id)
  ON DELETE CASCADE;
