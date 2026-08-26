-- NPL 改稱 SLN：更新既有資料與 check constraint

-- 1) 先移除 check constraint，否則 UPDATE 會被舊約束擋住
ALTER TABLE user_leave_records
  DROP CONSTRAINT IF EXISTS user_leave_records_leave_type_check;

-- 2) 將既有 leave_type 'NPL' 資料改為 'SLN'
UPDATE user_leave_records
SET leave_type = 'SLN'
WHERE leave_type = 'NPL';

-- 3) 重建 leave_type check constraint，以 'SLN' 取代 'NPL'
ALTER TABLE user_leave_records
  ADD CONSTRAINT user_leave_records_leave_type_check
    CHECK (
      (record_type = 'leave' AND leave_type IN ('AL', 'PRD', 'DO', 'SL', 'SLN', 'PH', 'SH'))
      OR
      (record_type = 'availability' AND leave_type IS NULL)
    );
