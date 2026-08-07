-- 排班管理：班次卡片可獨立編輯上下班時間，不單靠 daily_contract_hours 推算

ALTER TABLE user_shift_assignments
  ADD COLUMN IF NOT EXISTS end_time time;

COMMENT ON COLUMN user_shift_assignments.end_time IS '班次結束時間；NULL 時由 start_time + 員工 daily_contract_hours 推算';
