/*
  # 新增渡假事件類型枚舉 (第一部分)

  1. 枚舉類型擴展
    - 擴展 `episode_event_type` 枚舉：新增 'vacation_start' (渡假開始) 和 'vacation_end' (渡假結束)
    - 創建 `vacation_end_type` 枚舉：定義渡假結束的四種方式

  2. 安全性
    - 使用 IF NOT EXISTS 檢查確保冪等性
    - 分離枚舉定義和使用，避免 PostgreSQL 事務限制
*/

-- 擴展事件類型枚舉，新增渡假開始和渡假結束
DO $$ 
BEGIN
  -- 檢查 episode_event_type 是否存在
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'episode_event_type') THEN
    CREATE TYPE episode_event_type AS ENUM ('admission', 'transfer', 'discharge');
  END IF;
  
  -- 新增 vacation_start 如果不存在
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'vacation_start' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'episode_event_type')
  ) THEN
    ALTER TYPE episode_event_type ADD VALUE 'vacation_start';
  END IF;
  
  -- 新增 vacation_end 如果不存在
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'vacation_end' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'episode_event_type')
  ) THEN
    ALTER TYPE episode_event_type ADD VALUE 'vacation_end';
  END IF;
END $$;

-- 創建渡假結束類型枚舉
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vacation_end_type') THEN
    CREATE TYPE vacation_end_type AS ENUM (
      'return_to_facility',  -- 渡假後返回護老院
      'home',                -- 渡假後回到原居住地
      'transfer_out',        -- 轉至其他機構
      'deceased'             -- 院友渡假期間離世
    );
  END IF;
END $$;