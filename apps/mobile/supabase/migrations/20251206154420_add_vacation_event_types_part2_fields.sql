/*
  # 新增渡假事件相關欄位和索引 (第二部分)

  1. hospital_episodes 表擴展
    - `vacation_end_type`: 渡假結束類型 (可為空)
    - `vacation_destination`: 渡假目的地或轉至機構名稱 (可為空)
    - `vacation_contact`: 渡假期間聯絡方式 (可為空)
    - `vacation_remarks`: 渡假相關備註 (可為空)

  2. episode_events 表擴展
    - `vacation_destination`: 渡假目的地 (可為空)
    - `vacation_contact`: 渡假期間聯絡方式 (可為空)
    - 修改 `hospital_name` 為可空 (因為渡假事件不需要醫院名稱)

  3. 索引優化
    - 為渡假相關欄位新增索引以提升查詢效能
    - 為特定事件類型新增部分索引

  4. 安全性
    - 所有新欄位自動受現有 RLS 政策保護
*/

-- 擴展 hospital_episodes 表，新增渡假相關欄位
DO $$
BEGIN
  -- 新增 vacation_end_type 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hospital_episodes' AND column_name = 'vacation_end_type'
  ) THEN
    ALTER TABLE hospital_episodes ADD COLUMN vacation_end_type vacation_end_type;
  END IF;

  -- 新增 vacation_destination 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hospital_episodes' AND column_name = 'vacation_destination'
  ) THEN
    ALTER TABLE hospital_episodes ADD COLUMN vacation_destination text;
  END IF;

  -- 新增 vacation_contact 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hospital_episodes' AND column_name = 'vacation_contact'
  ) THEN
    ALTER TABLE hospital_episodes ADD COLUMN vacation_contact text;
  END IF;

  -- 新增 vacation_remarks 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hospital_episodes' AND column_name = 'vacation_remarks'
  ) THEN
    ALTER TABLE hospital_episodes ADD COLUMN vacation_remarks text;
  END IF;
END $$;

-- 擴展 episode_events 表，新增渡假相關欄位
DO $$
BEGIN
  -- 新增 vacation_destination 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'episode_events' AND column_name = 'vacation_destination'
  ) THEN
    ALTER TABLE episode_events ADD COLUMN vacation_destination text;
  END IF;

  -- 新增 vacation_contact 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'episode_events' AND column_name = 'vacation_contact'
  ) THEN
    ALTER TABLE episode_events ADD COLUMN vacation_contact text;
  END IF;
END $$;

-- 修改 hospital_name 為可空（渡假事件不需要醫院名稱）
ALTER TABLE episode_events ALTER COLUMN hospital_name DROP NOT NULL;

-- 新增索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_hospital_episodes_vacation_end_type 
  ON hospital_episodes(vacation_end_type) 
  WHERE vacation_end_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_episode_events_vacation_start 
  ON episode_events(event_date) 
  WHERE event_type = 'vacation_start';

CREATE INDEX IF NOT EXISTS idx_episode_events_vacation_end 
  ON episode_events(event_date) 
  WHERE event_type = 'vacation_end';

-- 新增註解說明
COMMENT ON COLUMN hospital_episodes.vacation_end_type IS '渡假結束類型：return_to_facility(返回護老院), home(回家), transfer_out(轉至其他機構), deceased(離世)';
COMMENT ON COLUMN hospital_episodes.vacation_destination IS '渡假目的地或轉至機構名稱';
COMMENT ON COLUMN hospital_episodes.vacation_contact IS '渡假期間聯絡方式';
COMMENT ON COLUMN hospital_episodes.vacation_remarks IS '渡假相關備註';
COMMENT ON COLUMN episode_events.vacation_destination IS '渡假目的地';
COMMENT ON COLUMN episode_events.vacation_contact IS '渡假期間聯絡方式';