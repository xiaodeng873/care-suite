/*
  # 建立 VMO 服務管理系統資料表

  1. 新資料表
    - `院友主表` - 儲存院友基本資料
    - `處方主表` - 儲存藥物處方資料
    - `到診排程主表` - 儲存醫生到診排程
    - `看診院友細項` - 儲存排程中的院友資料
    - `看診原因選項` - 儲存看診原因選項
    - `到診院友_看診原因` - 院友看診原因關聯表
  
  2. 安全設定
    - 為所有表啟用 RLS (Row Level Security)
    - 設定適當的存取權限政策
*/

-- 建立性別類型
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '性別類型') THEN
    CREATE TYPE 性別類型 AS ENUM ('男', '女');
  END IF;
END $$;

-- 建立院友主表
CREATE TABLE IF NOT EXISTS 院友主表 (
  院友id SERIAL PRIMARY KEY,
  床號 VARCHAR(10) NOT NULL,
  中文姓名 VARCHAR(50) NOT NULL,
  英文姓名 VARCHAR(100),
  性別 性別類型 NOT NULL,
  身份證號碼 VARCHAR(10),
  藥物敏感 TEXT,
  不良藥物反應 TEXT,
  出生日期 DATE
);

-- 啟用 RLS
ALTER TABLE 院友主表 ENABLE ROW LEVEL SECURITY;

-- 建立處方主表
CREATE TABLE IF NOT EXISTS 處方主表 (
  處方id SERIAL PRIMARY KEY,
  院友id INT NOT NULL,
  藥物來源 TEXT NOT NULL,
  處方日期 DATE NOT NULL,
  藥物名稱 VARCHAR(200) NOT NULL,
  劑型 VARCHAR(50),
  服用途徑 VARCHAR(50),
  服用份量 VARCHAR(50),
  服用次數 VARCHAR(50),
  服用日數 VARCHAR(50),
  FOREIGN KEY (院友id) REFERENCES 院友主表(院友id) ON DELETE CASCADE
);

-- 啟用 RLS
ALTER TABLE 處方主表 ENABLE ROW LEVEL SECURITY;

-- 建立到診排程主表
CREATE TABLE IF NOT EXISTS 到診排程主表 (
  排程id SERIAL PRIMARY KEY,
  到診日期 DATE NOT NULL
);

-- 啟用 RLS
ALTER TABLE 到診排程主表 ENABLE ROW LEVEL SECURITY;

-- 建立看診院友細項
CREATE TABLE IF NOT EXISTS 看診院友細項 (
  細項id SERIAL PRIMARY KEY,
  排程id INT NOT NULL,
  院友id INT NOT NULL,
  症狀說明 TEXT,
  備註 TEXT,
  FOREIGN KEY (排程id) REFERENCES 到診排程主表(排程id) ON DELETE CASCADE,
  FOREIGN KEY (院友id) REFERENCES 院友主表(院友id) ON DELETE CASCADE
);

-- 啟用 RLS
ALTER TABLE 看診院友細項 ENABLE ROW LEVEL SECURITY;

-- 建立看診原因選項
CREATE TABLE IF NOT EXISTS 看診原因選項 (
  原因id SERIAL PRIMARY KEY,
  原因名稱 VARCHAR(50) NOT NULL UNIQUE
);

-- 啟用 RLS
ALTER TABLE 看診原因選項 ENABLE ROW LEVEL SECURITY;

-- 建立到診院友_看診原因關聯表
CREATE TABLE IF NOT EXISTS 到診院友_看診原因 (
  細項id INT NOT NULL,
  原因id INT NOT NULL,
  PRIMARY KEY (細項id, 原因id),
  FOREIGN KEY (細項id) REFERENCES 看診院友細項(細項id) ON DELETE CASCADE,
  FOREIGN KEY (原因id) REFERENCES 看診原因選項(原因id) ON DELETE CASCADE
);

-- 啟用 RLS
ALTER TABLE 到診院友_看診原因 ENABLE ROW LEVEL SECURITY;

-- 插入默認看診原因
INSERT INTO 看診原因選項 (原因名稱) VALUES
  ('申訴不適'),
  ('約束物品同意書'),
  ('年度體檢'),
  ('其他')
ON CONFLICT (原因名稱) DO NOTHING;

-- 設定 RLS 政策
-- 允許已認證用戶讀取所有資料
CREATE POLICY "允許已認證用戶讀取院友資料" ON 院友主表
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶讀取處方資料" ON 處方主表
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶讀取排程資料" ON 到診排程主表
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶讀取看診院友細項" ON 看診院友細項
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶讀取看診原因" ON 看診原因選項
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶讀取看診原因關聯" ON 到診院友_看診原因
  FOR SELECT TO authenticated USING (true);

-- 允許已認證用戶修改資料
CREATE POLICY "允許已認證用戶修改院友資料" ON 院友主表
  FOR ALL TO authenticated USING (true);

CREATE POLICY "允許已認證用戶修改處方資料" ON 處方主表
  FOR ALL TO authenticated USING (true);

CREATE POLICY "允許已認證用戶修改排程資料" ON 到診排程主表
  FOR ALL TO authenticated USING (true);

CREATE POLICY "允許已認證用戶修改看診院友細項" ON 看診院友細項
  FOR ALL TO authenticated USING (true);

CREATE POLICY "允許已認證用戶修改看診原因" ON 看診原因選項
  FOR ALL TO authenticated USING (true);

CREATE POLICY "允許已認證用戶修改看診原因關聯" ON 到診院友_看診原因
  FOR ALL TO authenticated USING (true);