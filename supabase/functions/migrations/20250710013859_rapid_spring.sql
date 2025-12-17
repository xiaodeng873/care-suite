/*
  # 建立健康記錄主表

  1. 新資料表
    - `健康記錄主表` - 儲存院友健康狀況評估記錄
      - 支援生命表徵、血糖控制、體重控制三種記錄類型
      - 包含血壓、脈搏、體溫、血含氧量、呼吸頻率、血糖值、體重等欄位
  
  2. 安全設定
    - 啟用 RLS (Row Level Security)
    - 設定適當的存取權限政策
*/

-- 建立記錄類型枚舉
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '記錄類型') THEN
    CREATE TYPE 記錄類型 AS ENUM ('生命表徵', '血糖控制', '體重控制');
  END IF;
END $$;

-- 建立健康記錄主表
CREATE TABLE IF NOT EXISTS 健康記錄主表 (
  記錄id SERIAL PRIMARY KEY,
  院友id INT NOT NULL,
  記錄日期 DATE NOT NULL,
  記錄時間 TIME NOT NULL,
  記錄類型 記錄類型 NOT NULL,
  血壓收縮壓 INT,
  血壓舒張壓 INT,
  脈搏 INT,
  體溫 DECIMAL(4,1),
  血含氧量 INT,
  呼吸頻率 INT,
  血糖值 DECIMAL(4,1),
  體重 DECIMAL(5,1),
  備註 TEXT,
  記錄人員 VARCHAR(50),
  FOREIGN KEY (院友id) REFERENCES 院友主表(院友id) ON DELETE CASCADE
);

-- 啟用 RLS
ALTER TABLE 健康記錄主表 ENABLE ROW LEVEL SECURITY;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_健康記錄_院友id ON 健康記錄主表(院友id);
CREATE INDEX IF NOT EXISTS idx_健康記錄_日期 ON 健康記錄主表(記錄日期);
CREATE INDEX IF NOT EXISTS idx_健康記錄_類型 ON 健康記錄主表(記錄類型);

-- 設定 RLS 政策
-- 允許已認證用戶讀取健康記錄
CREATE POLICY "允許已認證用戶讀取健康記錄" ON 健康記錄主表
  FOR SELECT TO authenticated USING (true);

-- 允許已認證用戶修改健康記錄
CREATE POLICY "允許已認證用戶修改健康記錄" ON 健康記錄主表
  FOR ALL TO authenticated USING (true);