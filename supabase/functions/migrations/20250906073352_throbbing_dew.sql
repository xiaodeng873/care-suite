/*
  # Add dummy data to drug database

  1. New Data
    - Populate `medication_drug_database` table with 50+ realistic pharmaceutical entries
    - Include common medications used in elderly care facilities
    - Cover various drug types: 西藥, 中藥, 保健品, 外用藥
    - Include different administration routes: 口服, 注射, 外用, 滴眼, 滴耳, 鼻胃管

  2. Data Categories
    - Cardiovascular medications
    - Diabetes medications  
    - Pain management
    - Antibiotics
    - Vitamins and supplements
    - Topical medications
    - Eye and ear drops
    - Traditional Chinese medicines
*/

-- Insert dummy drug data
INSERT INTO medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes) VALUES
-- 心血管藥物
('Amlodipine 5mg', 'AMD001', '西藥', '口服', '片', '用於治療高血壓，每日一次'),
('Atenolol 50mg', 'ATN001', '西藥', '口服', '片', '用於治療高血壓和心律不整'),
('Aspirin 100mg', 'ASP001', '西藥', '口服', '片', '用於預防心血管疾病'),
('Simvastatin 20mg', 'SIM001', '西藥', '口服', '片', '用於降低膽固醇'),
('Digoxin 0.25mg', 'DIG001', '西藥', '口服', '片', '用於治療心房顫動'),

-- 糖尿病藥物
('Metformin 500mg', 'MET001', '西藥', '口服', '片', '用於治療第二型糖尿病'),
('Gliclazide 80mg', 'GLC001', '西藥', '口服', '片', '用於治療糖尿病'),
('Insulin Mixtard 30/70', 'INS001', '西藥', '注射', 'IU', '混合型胰島素'),
('Glimepiride 2mg', 'GLM001', '西藥', '口服', '片', '用於治療糖尿病'),

-- 止痛藥物
('Paracetamol 500mg', 'PCM001', '西藥', '口服', '片', '解熱鎮痛藥'),
('Ibuprofen 400mg', 'IBU001', '西藥', '口服', '片', '非類固醇消炎止痛藥'),
('Tramadol 50mg', 'TRA001', '西藥', '口服', '片', '中強度止痛藥'),
('Diclofenac Gel 1%', 'DCL001', '西藥', '外用', 'g', '外用消炎止痛凝膠'),

-- 抗生素
('Amoxicillin 500mg', 'AMX001', '西藥', '口服', '片', '廣譜抗生素'),
('Cephalexin 250mg', 'CEP001', '西藥', '口服', '片', '第一代頭孢菌素'),
('Ciprofloxacin 500mg', 'CIP001', '西藥', '口服', '片', '氟喹諾酮類抗生素'),

-- 腸胃藥物
('Omeprazole 20mg', 'OMP001', '西藥', '口服', '片', '質子泵抑制劑'),
('Ranitidine 150mg', 'RAN001', '西藥', '口服', '片', 'H2受體阻斷劑'),
('Loperamide 2mg', 'LOP001', '西藥', '口服', '片', '用於治療腹瀉'),
('Lactulose Syrup', 'LAC001', '西藥', '口服', 'ml', '用於治療便秘'),

-- 精神科藥物
('Lorazepam 1mg', 'LOR001', '西藥', '口服', '片', '短效苯二氮平類'),
('Haloperidol 5mg', 'HAL001', '西藥', '口服', '片', '典型抗精神病藥'),
('Risperidone 2mg', 'RIS001', '西藥', '口服', '片', '非典型抗精神病藥'),
('Sertraline 50mg', 'SER001', '西藥', '口服', '片', '選擇性血清素再攝取抑制劑'),

-- 維他命和保健品
('Vitamin D3 1000IU', 'VTD001', '保健品', '口服', '片', '維他命D補充劑'),
('Calcium Carbonate 500mg', 'CAL001', '保健品', '口服', '片', '鈣質補充劑'),
('Vitamin B Complex', 'VTB001', '保健品', '口服', '片', '維他命B群'),
('Omega-3 Fish Oil', 'OMG001', '保健品', '口服', '粒', '魚油補充劑'),
('Multivitamin', 'MVT001', '保健品', '口服', '片', '綜合維他命'),

-- 外用藥物
('Betamethasone Cream 0.1%', 'BET001', '外用藥', '外用', 'g', '類固醇外用藥膏'),
('Mupirocin Ointment 2%', 'MUP001', '外用藥', '外用', 'g', '抗生素軟膏'),
('Zinc Oxide Cream', 'ZNC001', '外用藥', '外用', 'g', '氧化鋅護膚膏'),
('Calamine Lotion', 'CAL002', '外用藥', '外用', 'ml', '爐甘石洗劑'),

-- 眼藥水和耳藥水
('Chloramphenicol Eye Drops', 'CHL001', '西藥', '滴眼', '滴', '抗生素眼藥水'),
('Artificial Tears', 'ART001', '西藥', '滴眼', '滴', '人工淚液'),
('Prednisolone Eye Drops', 'PRD001', '西藥', '滴眼', '滴', '類固醇眼藥水'),
('Waxsol Ear Drops', 'WAX001', '西藥', '滴耳', '滴', '軟化耳垢藥水'),

-- 呼吸系統藥物
('Salbutamol Inhaler', 'SAL001', '西藥', '吸入', '噴', '支氣管擴張劑'),
('Prednisolone 5mg', 'PRD002', '西藥', '口服', '片', '類固醇消炎藥'),
('Codeine Linctus', 'COD001', '西藥', '口服', 'ml', '止咳糖漿'),

-- 利尿劑
('Furosemide 40mg', 'FUR001', '西藥', '口服', '片', '袢利尿劑'),
('Spironolactone 25mg', 'SPI001', '西藥', '口服', '片', '保鉀利尿劑'),

-- 抗凝血藥物
('Warfarin 5mg', 'WAR001', '西藥', '口服', '片', '抗凝血藥物，需監測INR'),
('Clopidogrel 75mg', 'CLP001', '西藥', '口服', '片', '抗血小板藥物'),

-- 中藥
('六味地黃丸', 'LWD001', '中藥', '口服', '丸', '滋陰補腎中藥'),
('甘草片', 'GCP001', '中藥', '口服', '片', '止咳化痰中藥'),
('當歸補血湯', 'DGB001', '中藥', '口服', 'ml', '補血養血中藥湯劑'),
('麥門冬湯', 'MMD001', '中藥', '口服', 'ml', '潤肺止咳中藥湯劑'),
('逍遙散', 'XYS001', '中藥', '口服', 'g', '疏肝解鬱中藥散劑'),

-- 鼻胃管用藥
('Lansoprazole Suspension', 'LAN001', '西藥', '鼻胃管', 'ml', '質子泵抑制劑懸浮液'),
('Lactulose Solution', 'LAC002', '西藥', '鼻胃管', 'ml', '通便糖漿，適用鼻胃管'),

-- 其他常用藥物
('Panadol Suppository', 'PAN001', '西藥', '肛門', '粒', '退燒止痛栓劑'),
('Normal Saline 0.9%', 'NSL001', '西藥', '注射', 'ml', '生理鹽水注射液'),
('Heparin 5000IU', 'HEP001', '西藥', '注射', 'IU', '肝素注射液'),
('Glycerin Suppository', 'GLY001', '西藥', '肛門', '粒', '甘油栓劑通便'),

-- 皮膚護理
('Aqueous Cream', 'AQU001', '外用藥', '外用', 'g', '水性護膚霜'),
('Sudocrem', 'SUD001', '外用藥', '外用', 'g', '嬰兒護膚膏'),
('E45 Cream', 'E45001', '外用藥', '外用', 'g', '保濕護膚霜'),

-- 營養補充
('Ensure Plus', 'ENS001', '保健品', '口服', 'ml', '營養補充飲品'),
('Protein Powder', 'PRO001', '保健品', '口服', 'g', '蛋白質粉'),
('Iron Supplement', 'IRN001', '保健品', '口服', '片', '鐵質補充劑');