-- facility_settings 解除單列限制（多租戶）
--
-- 原設計是單列表：CONSTRAINT facility_settings_singleton CHECK (id = 1)，
-- 全 DB 只能有一列設定 → 新院舍永遠讀不到自己的設定，會跌入寫死善頤的預設值。
-- 改為每院舍一列（facility_id 已有），id 自動遞增。

ALTER TABLE facility_settings DROP CONSTRAINT IF EXISTS facility_settings_singleton;

-- id 不再固定 1，改為自動遞增（保留現有 id=1 列不變）
CREATE SEQUENCE IF NOT EXISTS facility_settings_id_seq;
SELECT setval('facility_settings_id_seq', (SELECT COALESCE(MAX(id), 1) FROM facility_settings));
ALTER TABLE facility_settings ALTER COLUMN id SET DEFAULT nextval('facility_settings_id_seq');

-- 新列不再預設善頤名稱（開新院舍時由閘門明確寫入名稱）
ALTER TABLE facility_settings ALTER COLUMN facility_name_zh SET DEFAULT '';
ALTER TABLE facility_settings ALTER COLUMN facility_name_en SET DEFAULT '';
