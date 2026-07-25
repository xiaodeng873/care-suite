-- 院舍設定（單列表）：儲存院舍名稱與標誌，供 HTML 匯出列印的頁首使用。
-- 採用單列設計（id 固定為 1），避免出現多筆設定。

CREATE TABLE IF NOT EXISTS facility_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  facility_name_zh text NOT NULL DEFAULT '善頤 (福群) 護老院',
  facility_name_en text DEFAULT 'SeniorCare',
  logo_data_uri text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facility_settings_singleton CHECK (id = 1)
);

ALTER TABLE facility_settings ENABLE ROW LEVEL SECURITY;

-- 與專案其他資料表一致：前端以 anon key 連線，權限於 UI 層（用戶管理權限）控管。
DROP POLICY IF EXISTS "允許讀取院舍設定" ON facility_settings;
DROP POLICY IF EXISTS "允許讀取院舍設定" ON facility_settings;

CREATE POLICY "允許讀取院舍設定" ON facility_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "允許新增院舍設定" ON facility_settings;
DROP POLICY IF EXISTS "允許新增院舍設定" ON facility_settings;

CREATE POLICY "允許新增院舍設定" ON facility_settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "允許更新院舍設定" ON facility_settings;
DROP POLICY IF EXISTS "允許更新院舍設定" ON facility_settings;

CREATE POLICY "允許更新院舍設定" ON facility_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 種子資料：沿用目前列印頁首的硬編內容作為預設值。
INSERT INTO facility_settings (id, facility_name_zh, facility_name_en)
VALUES (1, '善頤 (福群) 護老院', 'SeniorCare')
ON CONFLICT (id) DO NOTHING;
