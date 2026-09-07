-- 健康監測記錄：facility_id 索引，加速租戶隔離 RLS 過濾
CREATE INDEX IF NOT EXISTS idx_健康監測記錄_facility_id ON 健康監測記錄(facility_id);
