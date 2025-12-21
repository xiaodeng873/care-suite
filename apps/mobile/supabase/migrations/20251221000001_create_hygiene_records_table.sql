/*
  # 建立衛生記錄表格

  1. 新增表格
    - `hygiene_records` - 衛生記錄（每日一次）
      - `id` (uuid, primary key)
      - `patient_id` (integer, foreign key)
      - `record_date` (date) - 記錄日期
      - `time_slot` (text) - 時段（固定為 'daily'）
      
      -- 13 個護理項目（布爾值）
      - `has_bath` (boolean) - 沐浴
      - `has_face_wash` (boolean) - 洗面
      - `has_shave` (boolean) - 剃鬚
      - `has_oral_care` (boolean) - 洗牙漱口
      - `has_denture_care` (boolean) - 洗口受假牙
      - `has_nail_trim` (boolean) - 剪指甲
      - `has_bedding_change` (boolean) - 換被套
      - `has_sheet_pillow_change` (boolean) - 換床單枕袋
      - `has_cup_wash` (boolean) - 洗杯
      - `has_bedside_cabinet` (boolean) - 終理床頭櫃
      - `has_wardrobe` (boolean) - 終理衣箱
      
      -- 大便相關欄位
      - `bowel_count` (integer, nullable) - 大便次數（0 表示無大便，null 表示未記錄）
      - `bowel_amount` (text, nullable) - 大便量：少/中/多
      - `bowel_consistency` (text, nullable) - 大便性質：硬/軟/稀/水狀
      
      -- 標準欄位
      - `recorder` (text) - 記錄者
      - `notes` (text, nullable) - 備註
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. 安全性
    - 啟用 RLS
    - 允許已認證用戶完整 CRUD 操作

  3. 索引
    - 為 patient_id, record_date 建立索引
*/

-- 1. 創建衛生記錄表
CREATE TABLE IF NOT EXISTS hygiene_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  record_date date NOT NULL,
  time_slot text NOT NULL DEFAULT 'daily' CHECK (time_slot = 'daily'),
  
  -- 護理項目（布爾值，預設 false）
  has_bath boolean DEFAULT false,
  has_face_wash boolean DEFAULT false,
  has_shave boolean DEFAULT false,
  has_oral_care boolean DEFAULT false,
  has_denture_care boolean DEFAULT false,
  has_nail_trim boolean DEFAULT false,
  has_bedding_change boolean DEFAULT false,
  has_sheet_pillow_change boolean DEFAULT false,
  has_cup_wash boolean DEFAULT false,
  has_bedside_cabinet boolean DEFAULT false,
  has_wardrobe boolean DEFAULT false,
  
  -- 大便相關欄位
  bowel_count integer,
  bowel_amount text CHECK (bowel_amount IN ('少', '中', '多') OR bowel_amount IS NULL),
  bowel_consistency text CHECK (bowel_consistency IN ('硬', '軟', '稀', '水狀') OR bowel_consistency IS NULL),
  bowel_medication text,
  
  -- 標準欄位
  recorder text NOT NULL,
  status_notes text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- 確保每個院友每天只有一條記錄
  UNIQUE(patient_id, record_date)
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_hygiene_records_patient_date 
  ON hygiene_records (patient_id, record_date);

CREATE INDEX IF NOT EXISTS idx_hygiene_records_date 
  ON hygiene_records (record_date);

-- 3. 啟用 RLS
ALTER TABLE hygiene_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to hygiene_records"
  ON hygiene_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. 添加 updated_at 自動更新觸發器
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_hygiene_records_updated_at'
  ) THEN
    CREATE TRIGGER update_hygiene_records_updated_at
      BEFORE UPDATE ON hygiene_records
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 5. 添加表格和欄位註釋
COMMENT ON TABLE hygiene_records IS '衛生記錄表：記錄院友的日常衛生護理項目，每天執行一次';
COMMENT ON COLUMN hygiene_records.time_slot IS '時段，固定為 daily（每日一次）';
COMMENT ON COLUMN hygiene_records.bowel_count IS '大便次數：0 表示無大便，null 表示未記錄';
COMMENT ON COLUMN hygiene_records.bowel_amount IS '大便量：少/中/多';
COMMENT ON COLUMN hygiene_records.bowel_consistency IS '大便性質：硬/軟/稀/水狀';
COMMENT ON COLUMN hygiene_records.bowel_medication IS '大便藥：通便藥物記錄';
