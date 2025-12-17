/*
  # Create medication drug database table

  1. New Tables
    - `medication_drug_database`
      - `id` (uuid, primary key)
      - `drug_name` (text, required) - 藥物名稱
      - `drug_code` (text, optional) - 藥物編號
      - `drug_type` (text, optional) - 藥物類型 (西藥/中藥/保健品/外用藥)
      - `administration_route` (text, optional) - 給藥途徑 (口服/注射/外用/滴眼/滴耳/鼻胃管)
      - `unit` (text, optional) - 藥物單位 (mg/ml/片/滴)
      - `photo_url` (text, optional) - 藥物相片URL
      - `notes` (text, optional) - 備註
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `medication_drug_database` table
    - Add policy for authenticated users to read all drug data
    - Add policy for authenticated users to manage drug data

  3. Indexes
    - Index on drug_name for fast searching
    - Index on drug_code for unique identification
    - Index on drug_type for filtering
    - Index on administration_route for filtering
</*/

-- Create medication drug database table
CREATE TABLE IF NOT EXISTS medication_drug_database (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name text NOT NULL,
  drug_code text,
  drug_type text,
  administration_route text,
  unit text,
  photo_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE medication_drug_database ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "允許已認證用戶讀取藥物資料庫"
  ON medication_drug_database
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增藥物資料庫"
  ON medication_drug_database
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新藥物資料庫"
  ON medication_drug_database
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除藥物資料庫"
  ON medication_drug_database
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medication_drug_database_drug_name 
  ON medication_drug_database(drug_name);

CREATE INDEX IF NOT EXISTS idx_medication_drug_database_drug_code 
  ON medication_drug_database(drug_code);

CREATE INDEX IF NOT EXISTS idx_medication_drug_database_drug_type 
  ON medication_drug_database(drug_type);

CREATE INDEX IF NOT EXISTS idx_medication_drug_database_administration_route 
  ON medication_drug_database(administration_route);

-- Create unique constraint on drug_code if provided
CREATE UNIQUE INDEX IF NOT EXISTS medication_drug_database_drug_code_key 
  ON medication_drug_database(drug_code) 
  WHERE drug_code IS NOT NULL;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_medication_drug_database_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_medication_drug_database_updated_at
  BEFORE UPDATE ON medication_drug_database
  FOR EACH ROW
  EXECUTE FUNCTION update_medication_drug_database_updated_at();

-- Insert dummy data
INSERT INTO medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes) VALUES
-- 心血管藥物
('Amlodipine', 'CV001', '西藥', '口服', 'mg', '鈣離子通道阻斷劑，用於治療高血壓'),
('Atenolol', 'CV002', '西藥', '口服', 'mg', 'β受體阻斷劑，用於治療高血壓和心律不整'),
('Aspirin', 'CV003', '西藥', '口服', 'mg', '抗血小板藥物，用於預防心血管疾病'),
('Simvastatin', 'CV004', '西藥', '口服', 'mg', 'HMG-CoA還原酶抑制劑，用於降低膽固醇'),
('Digoxin', 'CV005', '西藥', '口服', 'mg', '強心劑，用於治療心衰竭和心房顫動'),
('Furosemide', 'CV006', '西藥', '口服', 'mg', '利尿劑，用於治療水腫和高血壓'),
('Warfarin', 'CV007', '西藥', '口服', 'mg', '抗凝血劑，用於預防血栓'),
('Clopidogrel', 'CV008', '西藥', '口服', 'mg', '抗血小板藥物，用於預防血栓'),

-- 糖尿病藥物
('Metformin', 'DM001', '西藥', '口服', 'mg', '雙胍類降血糖藥，一線糖尿病治療藥物'),
('Gliclazide', 'DM002', '西藥', '口服', 'mg', '磺脲類降血糖藥，刺激胰島素分泌'),
('Insulin Aspart', 'DM003', '西藥', '注射', 'IU', '速效胰島素，餐前注射'),
('Insulin Glargine', 'DM004', '西藥', '注射', 'IU', '長效胰島素，每日一次'),
('Glimepiride', 'DM005', '西藥', '口服', 'mg', '磺脲類降血糖藥，每日一次'),
('Acarbose', 'DM006', '西藥', '口服', 'mg', 'α-葡萄糖苷酶抑制劑，延緩糖分吸收'),

-- 止痛藥物
('Paracetamol', 'AN001', '西藥', '口服', 'mg', '解熱鎮痛藥，安全性高'),
('Ibuprofen', 'AN002', '西藥', '口服', 'mg', '非類固醇消炎藥，具消炎止痛效果'),
('Tramadol', 'AN003', '西藥', '口服', 'mg', '中樞性止痛藥，用於中重度疼痛'),
('Codeine', 'AN004', '西藥', '口服', 'mg', '鴉片類止痛藥，用於中度疼痛'),
('Morphine', 'AN005', '西藥', '口服', 'mg', '強效鴉片類止痛藥，用於重度疼痛'),

-- 抗生素
('Amoxicillin', 'AB001', '西藥', '口服', 'mg', '青黴素類抗生素，廣譜抗菌'),
('Cephalexin', 'AB002', '西藥', '口服', 'mg', '頭孢菌素類抗生素'),
('Ciprofloxacin', 'AB003', '西藥', '口服', 'mg', '氟喹諾酮類抗生素'),
('Erythromycin', 'AB004', '西藥', '口服', 'mg', '大環內酯類抗生素'),
('Clindamycin', 'AB005', '西藥', '口服', 'mg', '林可黴素類抗生素'),

-- 腸胃藥物
('Omeprazole', 'GI001', '西藥', '口服', 'mg', '質子泵抑制劑，用於治療胃酸過多'),
('Ranitidine', 'GI002', '西藥', '口服', 'mg', 'H2受體阻斷劑，減少胃酸分泌'),
('Loperamide', 'GI003', '西藥', '口服', 'mg', '止瀉藥，用於治療腹瀉'),
('Lactulose', 'GI004', '西藥', '口服', 'ml', '滲透性瀉藥，用於治療便秘'),
('Domperidone', 'GI005', '西藥', '口服', 'mg', '胃腸動力藥，用於治療噁心嘔吐'),
('Lansoprazole', 'GI006', '西藥', '鼻胃管', 'mg', '質子泵抑制劑，可經鼻胃管給藥'),

-- 精神科藥物
('Lorazepam', 'PS001', '西藥', '口服', 'mg', '苯二氮平類抗焦慮藥'),
('Haloperidol', 'PS002', '西藥', '口服', 'mg', '典型抗精神病藥'),
('Risperidone', 'PS003', '西藥', '口服', 'mg', '非典型抗精神病藥'),
('Sertraline', 'PS004', '西藥', '口服', 'mg', 'SSRI類抗憂鬱藥'),
('Zolpidem', 'PS005', '西藥', '口服', 'mg', '非苯二氮平類安眠藥'),
('Quetiapine', 'PS006', '西藥', '口服', 'mg', '非典型抗精神病藥，也用於睡眠障礙'),

-- 呼吸系統藥物
('Salbutamol', 'RS001', '西藥', '口服', 'mg', 'β2受體激動劑，支氣管擴張劑'),
('Prednisolone', 'RS002', '西藥', '口服', 'mg', '類固醇消炎藥'),
('Theophylline', 'RS003', '西藥', '口服', 'mg', '支氣管擴張劑'),
('Ipratropium', 'RS004', '西藥', '吸入', 'mcg', '抗膽鹼性支氣管擴張劑'),

-- 中藥
('六味地黃丸', 'CM001', '中藥', '口服', '丸', '滋陰補腎的經典方劑'),
('當歸補血湯', 'CM002', '中藥', '口服', '包', '補血調經的中藥方劑'),
('甘草片', 'CM003', '中藥', '口服', '片', '止咳化痰，調和諸藥'),
('麥門冬湯', 'CM004', '中藥', '口服', '包', '養陰潤燥，清熱生津'),
('逍遙散', 'CM005', '中藥', '口服', '包', '疏肝解鬱，健脾和胃'),
('補中益氣湯', 'CM006', '中藥', '口服', '包', '補中益氣，升陽舉陷'),
('安神定志丸', 'CM007', '中藥', '口服', '丸', '安神定志，用於失眠健忘'),
('天王補心丹', 'CM008', '中藥', '口服', '丸', '滋陰養血，補心安神'),

-- 保健品
('Vitamin D3', 'VT001', '保健品', '口服', 'IU', '維他命D3，促進鈣質吸收'),
('Vitamin B Complex', 'VT002', '保健品', '口服', '片', '維他命B群，維持神經系統健康'),
('Multivitamin', 'VT003', '保健品', '口服', '片', '綜合維他命，補充日常營養'),
('Calcium Carbonate', 'VT004', '保健品', '口服', 'mg', '鈣質補充劑，維持骨骼健康'),
('Iron Supplement', 'VT005', '保健品', '口服', 'mg', '鐵質補充劑，預防貧血'),
('Omega-3', 'VT006', '保健品', '口服', 'mg', '魚油，維持心血管健康'),
('Ensure Plus', 'VT007', '保健品', '口服', 'ml', '營養補充飲品'),
('Protein Powder', 'VT008', '保健品', '口服', 'g', '蛋白質粉，補充蛋白質'),
('Glucosamine', 'VT009', '保健品', '口服', 'mg', '葡萄糖胺，維持關節健康'),
('Coenzyme Q10', 'VT010', '保健品', '口服', 'mg', '輔酶Q10，抗氧化劑'),

-- 外用藥
('Betamethasone Cream', 'TP001', '外用藥', '外用', 'g', '類固醇消炎藥膏'),
('Mupirocin Ointment', 'TP002', '外用藥', '外用', 'g', '抗生素藥膏，用於皮膚感染'),
('Diclofenac Gel', 'TP003', '外用藥', '外用', 'g', '非類固醇消炎凝膠'),
('Zinc Oxide Cream', 'TP004', '外用藥', '外用', 'g', '氧化鋅藥膏，用於皮膚保護'),
('Aqueous Cream', 'TP005', '外用藥', '外用', 'g', '水性乳霜，用於皮膚保濕'),
('E45 Cream', 'TP006', '外用藥', '外用', 'g', '保濕乳霜，用於乾燥皮膚'),

-- 滴眼藥
('Chloramphenicol Eye Drops', 'EY001', '西藥', '滴眼', '滴', '抗生素滴眼液'),
('Artificial Tears', 'EY002', '西藥', '滴眼', '滴', '人工淚液，緩解眼乾'),
('Prednisolone Eye Drops', 'EY003', '西藥', '滴眼', '滴', '類固醇滴眼液，消炎用'),

-- 滴耳藥
('Waxsol Ear Drops', 'ER001', '西藥', '滴耳', '滴', '軟化耳垢的滴耳液'),

-- 注射劑
('Normal Saline', 'INJ001', '西藥', '注射', 'ml', '生理鹽水，用於注射和沖洗'),
('Heparin', 'INJ002', '西藥', '注射', 'IU', '肝素，抗凝血劑'),
('Insulin Regular', 'INJ003', '西藥', '注射', 'IU', '普通胰島素，短效'),

-- 其他常用藥物
('Acetylcysteine', 'OT001', '西藥', '口服', 'mg', '祛痰藥，稀釋痰液'),
('Allopurinol', 'OT002', '西藥', '口服', 'mg', '降尿酸藥，用於痛風'),
('Levothyroxine', 'OT003', '西藥', '口服', 'mcg', '甲狀腺激素，用於甲狀腺功能低下'),
('Alendronate', 'OT004', '西藥', '口服', 'mg', '雙磷酸鹽類，用於骨質疏鬆'),
('Donepezil', 'OT005', '西藥', '口服', 'mg', '膽鹼酯酶抑制劑，用於失智症');