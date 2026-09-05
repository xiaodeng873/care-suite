-- 為 health_task_type 枚舉新增「生命表徵」
-- 注意：ADD VALUE 必須與使用該值的 migration 分開，否則觸發 55P04 unsafe use of new value
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '生命表徵';
