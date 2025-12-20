-- 添加任務開始執行日期字段
-- 此字段用於記錄任務何時開始執行，與任務創建時間（created_at）不同
-- 小日歷將使用此字段來決定何時開始顯示補錄紅點

ALTER TABLE patient_health_tasks 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;

-- 為現有記錄設置 start_date 為 created_at（向後兼容）
UPDATE patient_health_tasks 
SET start_date = created_at 
WHERE start_date IS NULL;

-- 添加註釋
COMMENT ON COLUMN patient_health_tasks.start_date IS '任務開始執行日期，用於計算補錄紅點的起始日期';
