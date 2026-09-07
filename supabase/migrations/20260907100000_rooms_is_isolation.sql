-- 房間新增「隔離病房」標記
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_isolation boolean NOT NULL DEFAULT false;
