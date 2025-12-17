/*
  # 重新設計出入院記錄為住院事件

  1. 新表結構
    - `hospital_episodes` - 住院事件主表
    - `episode_events` - 事件詳細記錄（入院、轉院、出院）
    
  2. 設計理念
    - 每次入院開始一個新的住院事件
    - 轉院和出院都是同一住院事件的後續事件
    - 完整追蹤整個住院過程
    
  3. 安全性
    - 啟用 RLS
    - 添加適當的政策
*/

-- 住院事件狀態枚舉
CREATE TYPE episode_status AS ENUM ('active', 'completed', 'transferred');

-- 事件類型枚舉
CREATE TYPE episode_event_type AS ENUM ('admission', 'transfer', 'discharge');

-- 出院類型枚舉
CREATE TYPE discharge_type AS ENUM ('home', 'transfer_out', 'deceased');

-- 住院事件主表
CREATE TABLE IF NOT EXISTS hospital_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  episode_start_date date NOT NULL,
  episode_end_date date,
  status episode_status DEFAULT 'active',
  primary_hospital text,
  primary_ward text,
  primary_bed_number text,
  discharge_type discharge_type,
  discharge_destination text,
  date_of_death date,
  time_of_death time,
  total_days integer GENERATED ALWAYS AS (
    CASE 
      WHEN episode_end_date IS NOT NULL 
      THEN episode_end_date - episode_start_date + 1
      ELSE NULL 
    END
  ) STORED,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 事件詳細記錄表
CREATE TABLE IF NOT EXISTS episode_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES hospital_episodes(id) ON DELETE CASCADE,
  event_type episode_event_type NOT NULL,
  event_date date NOT NULL,
  event_time time,
  hospital_name text,
  hospital_ward text,
  hospital_bed_number text,
  event_order integer NOT NULL DEFAULT 1,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_hospital_episodes_patient_id ON hospital_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_episodes_status ON hospital_episodes(status);
CREATE INDEX IF NOT EXISTS idx_hospital_episodes_start_date ON hospital_episodes(episode_start_date);
CREATE INDEX IF NOT EXISTS idx_hospital_episodes_end_date ON hospital_episodes(episode_end_date);

CREATE INDEX IF NOT EXISTS idx_episode_events_episode_id ON episode_events(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_events_event_type ON episode_events(event_type);
CREATE INDEX IF NOT EXISTS idx_episode_events_event_date ON episode_events(event_date);
CREATE INDEX IF NOT EXISTS idx_episode_events_order ON episode_events(event_order);

-- 啟用 RLS
ALTER TABLE hospital_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_events ENABLE ROW LEVEL SECURITY;

-- RLS 政策
CREATE POLICY "Allow authenticated users to read hospital episodes"
  ON hospital_episodes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert hospital episodes"
  ON hospital_episodes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update hospital episodes"
  ON hospital_episodes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete hospital episodes"
  ON hospital_episodes
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read episode events"
  ON episode_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert episode events"
  ON episode_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update episode events"
  ON episode_events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete episode events"
  ON episode_events
  FOR DELETE
  TO authenticated
  USING (true);

-- 觸發器函數
CREATE OR REPLACE FUNCTION update_hospital_episodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_episode_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 觸發器
CREATE TRIGGER update_hospital_episodes_updated_at
  BEFORE UPDATE ON hospital_episodes
  FOR EACH ROW
  EXECUTE FUNCTION update_hospital_episodes_updated_at();

CREATE TRIGGER update_episode_events_updated_at
  BEFORE UPDATE ON episode_events
  FOR EACH ROW
  EXECUTE FUNCTION update_episode_events_updated_at();