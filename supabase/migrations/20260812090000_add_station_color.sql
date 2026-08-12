-- 居住區新增「代表顏色」欄位：供 StationManagement 色盤識別用
ALTER TABLE stations ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN stations.color IS '居住區代表顏色（hex，例如 #3b82f6）';
