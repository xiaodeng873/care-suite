-- 院舍名稱（英文）為選填欄位：確保資料庫層允許 NULL，並移除預設值，
-- 使前端清空英文名稱時能真正儲存為 NULL（而非回填預設 'SeniorCare'）。
-- 兩項變更對已為可空 / 無預設值的欄位皆為無害的冪等操作。

ALTER TABLE facility_settings ALTER COLUMN facility_name_en DROP NOT NULL;
ALTER TABLE facility_settings ALTER COLUMN facility_name_en DROP DEFAULT;
