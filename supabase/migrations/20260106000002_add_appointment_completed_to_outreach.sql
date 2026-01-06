-- 添加覆診狀態欄位到 hospital_outreach_records 表
-- 用於標示覆診是「已完成」還是「待完成」

-- 移除 patient_id 唯一約束，允許每名院友有多筆記錄
ALTER TABLE hospital_outreach_records
DROP CONSTRAINT IF EXISTS hospital_outreach_records_patient_id_key;

-- 添加 appointment_completed 欄位
ALTER TABLE hospital_outreach_records
ADD COLUMN IF NOT EXISTS appointment_completed BOOLEAN DEFAULT false;

-- 添加欄位註解
COMMENT ON COLUMN hospital_outreach_records.appointment_completed IS '覆診狀態：true=已完成，false=待完成';

-- 為 hospital_outreach_record_history 表也添加相同欄位（如果有歷史記錄表）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_outreach_record_history') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'hospital_outreach_record_history' 
            AND column_name = 'appointment_completed'
        ) THEN
            ALTER TABLE hospital_outreach_record_history
            ADD COLUMN appointment_completed BOOLEAN DEFAULT false;
        END IF;
    END IF;
END $$;
