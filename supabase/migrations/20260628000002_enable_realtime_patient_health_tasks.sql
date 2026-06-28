-- 啟用 patient_health_tasks 表的 Supabase Realtime
-- 讓前端可以透過 postgres_changes 訂閱即時更新
ALTER PUBLICATION supabase_realtime ADD TABLE patient_health_tasks;
