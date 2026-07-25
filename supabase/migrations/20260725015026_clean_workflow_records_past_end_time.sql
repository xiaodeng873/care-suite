-- 清理超過處方結束時間點的 medication_workflow_records
-- 目標：刪除 scheduled_date > end_date 的記錄，以及 end_date 當天 scheduled_time > end_time 的記錄。
-- 刪除範圍包含已簽署記錄（preparation/verification/dispensing 任一為 completed/failed），
-- 以符合「停服時間點後有簽署都要刪除」的業務規則。
-- 此 migration 可重複執行（idempotent）。

DELETE FROM medication_workflow_records
WHERE id IN (
  SELECT mwr.id
  FROM medication_workflow_records mwr
  JOIN new_medication_prescriptions nmp
    ON nmp.id = mwr.prescription_id
  WHERE nmp.end_date IS NOT NULL
    AND (
      mwr.scheduled_date > nmp.end_date
      OR (
        mwr.scheduled_date = nmp.end_date
        AND COALESCE(mwr.scheduled_time, '00:00') > COALESCE(nmp.end_time, '23:59')
      )
    )
);

-- 回傳受影響筆數的提示（不影響 schema，只供日誌參考）
DO $$
BEGIN
  RAISE NOTICE '已清理超過處方結束時間點的 workflow records';
END
$$;
