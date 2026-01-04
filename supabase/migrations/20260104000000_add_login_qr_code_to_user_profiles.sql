-- =====================================================
-- 新增用戶登入二維碼欄位
-- Add login QR code field to user_profiles
-- =====================================================

-- Step 1: 新增 login_qr_code_id 欄位
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS login_qr_code_id text UNIQUE DEFAULT gen_random_uuid()::text;

-- Step 2: 為所有現有用戶生成 login_qr_code_id
UPDATE user_profiles
SET login_qr_code_id = gen_random_uuid()::text
WHERE login_qr_code_id IS NULL;

-- Step 3: 設定 login_qr_code_id 為 NOT NULL
ALTER TABLE user_profiles
ALTER COLUMN login_qr_code_id SET NOT NULL;

-- Step 4: 建立索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_user_profiles_login_qr_code_id ON user_profiles(login_qr_code_id);

-- Step 5: 添加註解
COMMENT ON COLUMN user_profiles.login_qr_code_id IS '用戶登入二維碼識別碼（UUID格式），用於掃描登入';
