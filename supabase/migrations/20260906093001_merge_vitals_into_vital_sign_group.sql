-- 將四項生命表徵任務（血壓、脈搏、血含氧量、呼吸）合併為單一「生命表徵」任務
--
-- 合併規則：同一院友、同一院舍、同一頻率、同一時間設定、同一備註的四項任務，
-- 合併成一條 health_record_type = '生命表徵' 的任務。
-- last_completed_at 取四者之 MAX，next_due_at 取四者之 MIN。

BEGIN;

-- 1. 建立合併後的生命表徵任務
INSERT INTO patient_health_tasks (
    patient_id,
    facility_id,
    health_record_type,
    frequency_unit,
    frequency_value,
    specific_times,
    specific_days_of_week,
    specific_days_of_month,
    notes,
    is_recurring,
    start_date,
    end_date,
    end_time,
    last_completed_at,
    next_due_at,
    created_at
)
SELECT
    patient_id,
    facility_id,
    '生命表徵'::health_task_type,
    frequency_unit,
    frequency_value,
    specific_times,
    specific_days_of_week,
    specific_days_of_month,
    notes,
    is_recurring,
    start_date,
    end_date,
    end_time,
    MAX(last_completed_at),
    MIN(next_due_at),
    MIN(created_at)
FROM patient_health_tasks
WHERE health_record_type IN ('血壓', '脈搏', '血含氧量', '呼吸')
GROUP BY
    patient_id,
    facility_id,
    frequency_unit,
    frequency_value,
    specific_times,
    specific_days_of_week,
    specific_days_of_month,
    notes,
    is_recurring,
    start_date,
    end_date,
    end_time;

-- 2. 刪除原有四項獨立任務
DELETE FROM patient_health_tasks
WHERE health_record_type IN ('血壓', '脈搏', '血含氧量', '呼吸');

-- 3. 驗證：四項任務必須清零
DO $$
DECLARE
    remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining
    FROM patient_health_tasks
    WHERE health_record_type IN ('血壓', '脈搏', '血含氧量', '呼吸');

    IF remaining > 0 THEN
        RAISE EXCEPTION '合併失敗：仍有 % 條四項任務未刪除', remaining;
    END IF;
END $$;

COMMIT;
