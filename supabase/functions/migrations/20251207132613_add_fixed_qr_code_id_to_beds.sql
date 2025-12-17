/*
  # 為床位新增固定QR Code識別碼

  1. 新增欄位
    - `qr_code_id` (text, unique, not null)
      - 儲存UUID格式的固定QR code唯一識別碼
      - 每個床位擁有永久不變的識別碼
      - 用於QR code掃描時快速定位床位
    
    - `qr_code_generated_at` (timestamptz)
      - 記錄QR code識別碼首次生成的時間
      - 預設值為當前時間

  2. 索引
    - 在qr_code_id上建立唯一索引以優化查詢效能

  3. 資料遷移
    - 為所有現有床位自動生成UUID格式的qr_code_id
    - 確保每個床位都有固定的唯一識別碼

  4. 設計考量
    - QR code內容從動態資料改為使用固定的UUID識別碼
    - 院友換床時不需重新列印QR code標籤
    - 掃描QR code時使用qr_code_id查詢床位，再查詢當前入住院友
*/

-- Step 1: 新增qr_code_id欄位（暫時允許NULL以便資料遷移）
ALTER TABLE beds 
ADD COLUMN IF NOT EXISTS qr_code_id text,
ADD COLUMN IF NOT EXISTS qr_code_generated_at timestamptz DEFAULT now();

-- Step 2: 為所有現有床位生成UUID格式的qr_code_id
UPDATE beds 
SET qr_code_id = gen_random_uuid()::text,
    qr_code_generated_at = now()
WHERE qr_code_id IS NULL;

-- Step 3: 設定qr_code_id為NOT NULL並建立唯一約束
ALTER TABLE beds 
ALTER COLUMN qr_code_id SET NOT NULL,
ALTER COLUMN qr_code_id SET DEFAULT gen_random_uuid()::text,
ADD CONSTRAINT beds_qr_code_id_unique UNIQUE (qr_code_id);

-- Step 4: 建立索引以優化查詢效能
CREATE INDEX IF NOT EXISTS idx_beds_qr_code_id ON beds(qr_code_id);

-- Step 5: 新增註解說明
COMMENT ON COLUMN beds.qr_code_id IS '床位固定QR Code識別碼（UUID格式），用於掃描定位床位';
COMMENT ON COLUMN beds.qr_code_generated_at IS 'QR Code識別碼首次生成時間';
