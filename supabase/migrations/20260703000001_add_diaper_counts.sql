-- Add urine_count and core_count columns to diaper_change_records
ALTER TABLE diaper_change_records
ADD COLUMN IF NOT EXISTS urine_count integer,
ADD COLUMN IF NOT EXISTS core_count integer;

-- Add comments to explain the new columns
COMMENT ON COLUMN diaper_change_records.urine_count IS '尿片數量';
COMMENT ON COLUMN diaper_change_records.core_count IS '片芯數量';
