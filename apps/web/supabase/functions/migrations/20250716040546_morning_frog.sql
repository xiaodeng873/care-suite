/*
  # 創建覆診安排功能

  1. 新增覆診狀態枚舉類型
  2. 新增覆診安排主表
     - `覆診id` (uuid, primary key)
     - `院友id` (integer, foreign key)
     - `覆診日期` (date)
     - `出發時間` (time)
     - `覆診時間` (time)
     - `覆診地點` (text)
     - `覆診專科` (text)
     - `交通安排` (text)
     - `陪診人員` (text)
     - `備註` (text)
     - `狀態` (覆診狀態)
     - `創建時間` (timestamptz)
     - `更新時間` (timestamptz)
  3. 啟用 RLS 並新增相關策略
  4. 新增索引以提升查詢效能
  5. 新增自動更新時間戳的觸發器
*/

-- 檢查並創建覆診狀態枚舉
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '覆診狀態') THEN
        CREATE TYPE 覆診狀態 AS ENUM ('已安排', '已完成', '改期', '取消');
    END IF;
END $$;

-- 創建覆診安排主表
CREATE TABLE IF NOT EXISTS 覆診安排主表 (
  覆診id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  院友id integer NOT NULL REFERENCES 院友主表(院友id) ON DELETE CASCADE,
  覆診日期 date NOT NULL,
  出發時間 time,
  覆診時間 time,
  覆診地點 text,
  覆診專科 text,
  交通安排 text DEFAULT '尚未安排',
  陪診人員 text DEFAULT '尚未安排',
  備註 text,
  狀態 覆診狀態 DEFAULT '已安排',
  創建時間 timestamptz DEFAULT now(),
  更新時間 timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE 覆診安排主表 ENABLE ROW LEVEL SECURITY;

-- 新增索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_覆診安排_院友id ON 覆診安排主表(院友id);
CREATE INDEX IF NOT EXISTS idx_覆診安排_覆診日期 ON 覆診安排主表(覆診日期);
CREATE INDEX IF NOT EXISTS idx_覆診安排_狀態 ON 覆診安排主表(狀態);

-- 新增 RLS 策略
DO $$
BEGIN
    -- 檢查策略是否已存在，如果不存在則創建
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = '覆診安排主表' 
        AND policyname = '允許已認證用戶讀取覆診安排'
    ) THEN
        CREATE POLICY "允許已認證用戶讀取覆診安排"
          ON 覆診安排主表
          FOR SELECT
          TO authenticated
          USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = '覆診安排主表' 
        AND policyname = '允許已認證用戶新增覆診安排'
    ) THEN
        CREATE POLICY "允許已認證用戶新增覆診安排"
          ON 覆診安排主表
          FOR INSERT
          TO authenticated
          WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = '覆診安排主表' 
        AND policyname = '允許已認證用戶更新覆診安排'
    ) THEN
        CREATE POLICY "允許已認證用戶更新覆診安排"
          ON 覆診安排主表
          FOR UPDATE
          TO authenticated
          USING (true)
          WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = '覆診安排主表' 
        AND policyname = '允許已認證用戶刪除覆診安排'
    ) THEN
        CREATE POLICY "允許已認證用戶刪除覆診安排"
          ON 覆診安排主表
          FOR DELETE
          TO authenticated
          USING (true);
    END IF;
END $$;

-- 創建或替換自動更新時間戳函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.更新時間 = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 檢查並創建觸發器
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_覆診安排主表_updated_at'
    ) THEN
        CREATE TRIGGER update_覆診安排主表_updated_at
            BEFORE UPDATE ON 覆診安排主表
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;