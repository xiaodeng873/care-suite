-- 加速「只載入有院友相片的院友」查詢，避免掃描整張院友主表導致 statement_timeout (57014)
CREATE INDEX IF NOT EXISTS idx_patients_with_photo
ON 院友主表(院友id)
WHERE 院友相片 IS NOT NULL;
