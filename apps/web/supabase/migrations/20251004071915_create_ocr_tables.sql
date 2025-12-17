/*
  # 建立OCR處方標籤識別功能相關資料表

  1. 新增資料表
    - `ocr_prompt_templates` - 系統預設OCR prompt模板
      - `id` (uuid, primary key)
      - `name` (text) - 模板名稱
      - `description` (text) - 模板說明
      - `prompt_content` (text) - prompt內容
      - `is_default` (boolean) - 是否為預設模板
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `user_ocr_prompts` - 用戶自訂OCR prompt
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `prompt_content` (text) - prompt內容
      - `is_active` (boolean) - 是否為當前使用的prompt
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `ocr_recognition_logs` - OCR識別歷史記錄
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `image_hash` (text) - 圖片hash值，用於快取
      - `ocr_text` (text) - OCR識別的原始文字
      - `extracted_data` (jsonb) - AI擷取的結構化資料
      - `prompt_used` (text) - 使用的prompt
      - `confidence_scores` (jsonb) - 各欄位的信心度分數
      - `success` (boolean) - 識別是否成功
      - `error_message` (text) - 錯誤訊息（如果失敗）
      - `processing_time_ms` (integer) - 處理時間（毫秒）
      - `created_at` (timestamptz)

  2. 安全性
    - 為所有表啟用RLS
    - 用戶只能存取自己的資料
    - 所有用戶可讀取系統預設模板
*/

-- 建立OCR prompt模板表
CREATE TABLE IF NOT EXISTS ocr_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prompt_content text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 建立用戶OCR prompt表
CREATE TABLE IF NOT EXISTS user_ocr_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_content text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 建立OCR識別記錄表
CREATE TABLE IF NOT EXISTS ocr_recognition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  image_hash text,
  ocr_text text,
  extracted_data jsonb,
  prompt_used text,
  confidence_scores jsonb,
  success boolean DEFAULT true,
  error_message text,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- 為image_hash建立索引以加速快取查詢
CREATE INDEX IF NOT EXISTS idx_ocr_logs_image_hash ON ocr_recognition_logs(image_hash);
CREATE INDEX IF NOT EXISTS idx_ocr_logs_user_created ON ocr_recognition_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_prompts_active ON user_ocr_prompts(user_id, is_active);

-- 啟用RLS
ALTER TABLE ocr_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ocr_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_recognition_logs ENABLE ROW LEVEL SECURITY;

-- OCR prompt模板政策：所有認證用戶可讀取
CREATE POLICY "Anyone can view prompt templates"
  ON ocr_prompt_templates FOR SELECT
  TO authenticated
  USING (true);

-- 用戶OCR prompt政策：用戶只能存取自己的prompt
CREATE POLICY "Users can view own prompts"
  ON user_ocr_prompts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts"
  ON user_ocr_prompts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompts"
  ON user_ocr_prompts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompts"
  ON user_ocr_prompts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- OCR識別記錄政策：用戶只能存取自己的記錄
CREATE POLICY "Users can view own logs"
  ON ocr_recognition_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON ocr_recognition_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 插入系統預設prompt模板
INSERT INTO ocr_prompt_templates (name, description, prompt_content, is_default) VALUES
(
  '標準處方標籤識別',
  '適用於香港醫院和診所的標準處方標籤，自動識別並轉換為繁體中文',
  E'你是醫療資料分類的專家，你能從文本中熟練地分辨、提取有效的資料，其他都會自動中文化（藥物名稱以外），數字阿拉伯化

請根據以下OCR識別的文本提取處方標籤資訊。

提取時必須嚴格遵守以下規則：
1. 提取藥物來源時，不要提取完整地址，僅提取藥房名稱或醫生名稱
2. 如果提取不到院友姓名，必須反覆再尋找，一定會找到，不得留空
3. 藥物名稱必須包括其劑量（如果標籤上有顯示）
4. 劑型必須從以下選項中選擇：片劑、膠囊、藥水、注射劑、外用藥膏、滴劑
5. 服用途徑必須從以下選項中選擇：口服、注射、外用、滴眼、滴耳、鼻胃管
6. 服用份量的單位必須從以下選項中選擇：粒、片、膠囊、毫升、滴、口、支、包、茶匙、湯匙、mg、ml、g、mcg、IU
7. 提取"服用日數"時要附有量詞，例如："5日"
8. 如果藥物標籤出現"需要時"、"PRN"、"有需要時"等字樣，判定為需要時服藥（true），否則是false
9. 處方日期、開始日期必須為YYYY-MM-DD格式
10. 服用時間必須為24小時制HH:MM格式的陣列，例如：["08:00", "14:00", "20:00"]

請以JSON格式返回以下欄位（如果標籤上沒有的欄位，可以省略）：
{
  "院友姓名": "陳大文",
  "處方日期": "2025-04-30",
  "藥物名稱": "Paracetamol 500mg",
  "藥物來源": "樂善堂李賢義伉儷社區藥房",
  "劑型": "片劑",
  "服用途徑": "口服",
  "服用份量": "1",
  "服用單位": "片",
  "服用次數": "3",
  "服用日數": "5日",
  "需要時": false,
  "備註": "需配合潤滑劑使用",
  "總數": "15",
  "服用時間": ["08:00", "14:00", "20:00"]
}',
  true
),
(
  '簡化版識別',
  '僅提取核心欄位，適用於資訊不完整的處方標籤',
  E'你是醫療資料分類的專家，請從OCR文本中提取處方標籤的核心資訊。

規則：
1. 藥物名稱包含劑量
2. 劑型選項：片劑、膠囊、藥水、注射劑、外用藥膏、滴劑
3. 服用途徑選項：口服、注射、外用、滴眼、滴耳、鼻胃管
4. 日期格式：YYYY-MM-DD
5. 時間格式：24小時制陣列，如["08:00", "20:00"]

僅返回JSON格式，包含以下可用欄位：
{
  "院友姓名": "必填",
  "藥物名稱": "必填",
  "處方日期": "YYYY-MM-DD",
  "劑型": "從選項中選擇",
  "服用途徑": "從選項中選擇",
  "服用時間": ["08:00"]
}',
  false
);
