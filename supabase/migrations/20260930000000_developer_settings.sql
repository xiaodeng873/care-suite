-- 開發者（Supabase 登入、無 user_profiles 記錄）嘅個人設定由 DB 統一管理
-- 同 user_profiles 一樣：已認證用戶可讀/更新（RLS 模式一致）

CREATE TABLE IF NOT EXISTS developer_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE developer_settings IS '開發者帳戶嘅個人設定（無 user_profiles 記錄，同用戶一樣由 DB 管理）：key=設定名稱，value=設定內容 jsonb';

ALTER TABLE developer_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許已認證用戶讀取開發者設定" ON developer_settings;
CREATE POLICY "允許已認證用戶讀取開發者設定" ON developer_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "允許已認證用戶新增開發者設定" ON developer_settings;
CREATE POLICY "允許已認證用戶新增開發者設定" ON developer_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "允許已認證用戶更新開發者設定" ON developer_settings;
CREATE POLICY "允許已認證用戶更新開發者設定" ON developer_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
