-- 復康服務記錄 (Rehabilitation Records)
-- 創建日期: 2026-05-26

CREATE TABLE IF NOT EXISTS rehab_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id INTEGER NOT NULL REFERENCES patients(院友id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  service_type TEXT NOT NULL,                -- 服務類型：物理治療 / 職業治療 / 言語治療 / 日常活動訓練 / 其他
  therapist_name TEXT,                       -- 治療師姓名
  session_duration INTEGER,                  -- 每節時長（分鐘）
  goals TEXT,                                -- 治療目標
  progress_notes TEXT,                       -- 進度備註
  next_session_date DATE,                    -- 下次預約日期（可選）
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rehab_records_patient_id   ON rehab_records(patient_id);
CREATE INDEX idx_rehab_records_service_date ON rehab_records(service_date DESC);

-- RLS
ALTER TABLE rehab_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rehab_records_select" ON rehab_records
  FOR SELECT USING (true);

CREATE POLICY "rehab_records_insert" ON rehab_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "rehab_records_update" ON rehab_records
  FOR UPDATE USING (true);

CREATE POLICY "rehab_records_delete" ON rehab_records
  FOR DELETE USING (true);

-- updated_at 自動更新觸發器
CREATE OR REPLACE FUNCTION update_rehab_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rehab_records_updated_at
  BEFORE UPDATE ON rehab_records
  FOR EACH ROW EXECUTE FUNCTION update_rehab_records_updated_at();
