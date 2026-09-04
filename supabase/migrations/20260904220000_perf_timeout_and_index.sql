-- 1. 放寬 statement_timeout：8 秒太短，登入查詢風暴／繁忙時段持續觸發 57014
--    （用戶長期反映「不時 timeout」：儲存處方、載入相片、逾期統計等）。
--    數據庫僅 120MB，30 秒上限不會造成風險，但可大幅提升繁忙時段成功率。
ALTER ROLE authenticated SET statement_timeout = '30000';

-- 2. 逾期工作流程統計加速：partial covering index 只包 pending 記錄，
--    對應 get_overdue_workflow_counts 嘅 WHERE 條件，避免全表掃描
CREATE INDEX IF NOT EXISTS idx_wf_pending_overdue
ON medication_workflow_records (scheduled_date, patient_id)
INCLUDE (prescription_id, scheduled_time, preparation_status, verification_status, dispensing_status)
WHERE preparation_status = 'pending' OR verification_status = 'pending' OR dispensing_status = 'pending';
