-- 假期預排：支援「能夠上班時間」與「必須 / 希望」必要程度
-- 1) user_leave_records 增加 record_type / urgency / availability 時間 / override 標記
-- 2) leave_type 改為 nullable（availability 記錄不需要 leave_type）

-- =====================================================
-- 1) 新增欄位
-- =====================================================
ALTER TABLE user_leave_records
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'leave',
  ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'mandatory',
  ADD COLUMN IF NOT EXISTS availability_start_time text,
  ADD COLUMN IF NOT EXISTS availability_end_time text,
  ADD COLUMN IF NOT EXISTS is_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overridden_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overridden_at timestamptz;

-- =====================================================
-- 2) leave_type 改為 nullable
-- =====================================================
ALTER TABLE user_leave_records
  ALTER COLUMN leave_type DROP NOT NULL;

-- =====================================================
-- 3) 更新既有資料的 record_type / urgency
-- =====================================================
UPDATE user_leave_records
SET record_type = 'leave',
    urgency = 'mandatory',
    is_overridden = false
WHERE record_type IS NULL;

-- =====================================================
-- 4) 重新建立 check constraint
-- =====================================================
ALTER TABLE user_leave_records
  DROP CONSTRAINT IF EXISTS user_leave_records_leave_type_check;

ALTER TABLE user_leave_records
  ADD CONSTRAINT user_leave_records_leave_type_check
    CHECK (
      (record_type = 'leave' AND leave_type IN ('AL', 'PRD', 'DO', 'SL', 'CL', 'NPL', 'PH', 'SH'))
      OR
      (record_type = 'availability' AND leave_type IS NULL)
    );

ALTER TABLE user_leave_records
  DROP CONSTRAINT IF EXISTS user_leave_records_record_type_check;

ALTER TABLE user_leave_records
  ADD CONSTRAINT user_leave_records_record_type_check
    CHECK (record_type IN ('leave', 'availability'));

ALTER TABLE user_leave_records
  DROP CONSTRAINT IF EXISTS user_leave_records_urgency_check;

ALTER TABLE user_leave_records
  ADD CONSTRAINT user_leave_records_urgency_check
    CHECK (urgency IN ('mandatory', 'preferred'));

ALTER TABLE user_leave_records
  DROP CONSTRAINT IF EXISTS user_leave_records_availability_times_check;

ALTER TABLE user_leave_records
  ADD CONSTRAINT user_leave_records_availability_times_check
    CHECK (
      record_type <> 'availability'
      OR (
        availability_start_time IS NOT NULL
        AND availability_end_time IS NOT NULL
      )
    );

-- =====================================================
-- 5) 索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_leave_records_record_type
  ON user_leave_records(record_type);

COMMENT ON COLUMN user_leave_records.record_type IS '預排類型：leave = 放假；availability = 能夠上班時間';
COMMENT ON COLUMN user_leave_records.urgency IS '必要程度：mandatory = 必須；preferred = 希望';
COMMENT ON COLUMN user_leave_records.availability_start_time IS '能夠上班時間起點（HH:MM），僅 availability 使用';
COMMENT ON COLUMN user_leave_records.availability_end_time IS '能夠上班時間終點（HH:MM），僅 availability 使用';
COMMENT ON COLUMN user_leave_records.is_overridden IS '主管是否已 override 希望類申請';
