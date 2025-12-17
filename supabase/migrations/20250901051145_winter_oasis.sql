/*
  # Add dummy drug data for topical and injection medications

  1. New Data
    - Add sample topical medications (外用藥物)
    - Add sample injection medications (針劑藥物)
    - Include drug codes, types, administration routes, and units
  
  2. Data Categories
    - Topical medications: creams, ointments, drops
    - Injection medications: IV, IM, SC injections
    - Complete with realistic drug information
*/

-- Insert dummy topical medications (外用藥物)
INSERT INTO medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes) VALUES
('Betnovate Cream 0.1%', 'BET001', '類固醇外用藥', '外用', 'g', '用於濕疹、皮炎等炎症性皮膚病'),
('Fucidic Acid Cream 2%', 'FUC002', '抗生素外用藥', '外用', 'g', '用於細菌性皮膚感染'),
('Calamine Lotion', 'CAL003', '止癢外用藥', '外用', 'ml', '用於皮膚搔癢、蚊蟲叮咬'),
('Gentamicin Eye Drops 0.3%', 'GEN004', '抗生素眼藥', '滴眼', '滴', '用於眼部細菌感染'),
('Chloramphenicol Eye Ointment 1%', 'CHL005', '抗生素眼藥膏', '外用', 'g', '用於眼部感染'),
('Hydrocortisone Cream 1%', 'HYD006', '類固醇外用藥', '外用', 'g', '用於輕度皮膚炎症'),
('Silver Sulfadiazine Cream 1%', 'SIL007', '抗菌外用藥', '外用', 'g', '用於燒傷、傷口感染預防'),
('Mupirocin Ointment 2%', 'MUP008', '抗生素外用藥', '外用', 'g', '用於皮膚細菌感染'),
('Ketoconazole Cream 2%', 'KET009', '抗真菌外用藥', '外用', 'g', '用於真菌性皮膚感染'),
('Diclofenac Gel 1%', 'DIC010', '消炎止痛外用藥', '外用', 'g', '用於肌肉關節疼痛'),
('Timolol Eye Drops 0.5%', 'TIM011', '青光眼眼藥', '滴眼', '滴', '用於降低眼壓'),
('Artificial Tears', 'ART012', '人工淚液', '滴眼', '滴', '用於乾眼症'),
('Nystatin Cream', 'NYS013', '抗真菌外用藥', '外用', 'g', '用於念珠菌皮膚感染'),
('Zinc Oxide Cream', 'ZIN014', '保護性外用藥', '外用', 'g', '用於尿布疹、皮膚保護'),
('Povidone Iodine Solution 10%', 'POV015', '消毒外用藥', '外用', 'ml', '用於傷口消毒');

-- Insert dummy injection medications (針劑藥物)
INSERT INTO medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes) VALUES
('Normal Saline 0.9%', 'SAL101', '靜脈輸液', '注射', 'ml', '用於補充體液、稀釋藥物'),
('Dextrose 5% in Water', 'DEX102', '靜脈輸液', '注射', 'ml', '用於補充水分和葡萄糖'),
('Insulin Actrapid', 'INS103', '胰島素', '注射', '單位', '用於糖尿病血糖控制'),
('Heparin Injection 5000 IU/ml', 'HEP104', '抗凝血劑', '注射', 'ml', '用於預防血栓形成'),
('Morphine Injection 10mg/ml', 'MOR105', '強效止痛劑', '注射', 'ml', '用於嚴重疼痛控制'),
('Furosemide Injection 20mg/2ml', 'FUR106', '利尿劑', '注射', 'ml', '用於水腫、心衰治療'),
('Adrenaline Injection 1mg/ml', 'ADR107', '急救藥物', '注射', 'ml', '用於過敏性休克、心跳停止'),
('Vitamin B12 Injection 1000mcg/ml', 'VIT108', '維他命注射劑', '注射', 'ml', '用於維他命B12缺乏症'),
('Dexamethasone Injection 4mg/ml', 'DEX109', '類固醇注射劑', '注射', 'ml', '用於嚴重過敏、炎症'),
('Gentamicin Injection 80mg/2ml', 'GEN110', '抗生素注射劑', '注射', 'ml', '用於嚴重細菌感染'),
('Diazepam Injection 10mg/2ml', 'DIA111', '鎮靜劑', '注射', 'ml', '用於癲癇、焦慮症'),
('Tramadol Injection 100mg/2ml', 'TRA112', '止痛劑', '注射', 'ml', '用於中度至重度疼痛'),
('Ondansetron Injection 4mg/2ml', 'OND113', '止嘔劑', '注射', 'ml', '用於化療後嘔吐'),
('Metoclopramide Injection 10mg/2ml', 'MET114', '胃腸動力藥', '注射', 'ml', '用於噁心嘔吐'),
('Enoxaparin Injection 40mg/0.4ml', 'ENO115', '低分子肝素', '注射', 'ml', '用於預防深靜脈血栓'),
('Ceftriaxone Injection 1g', 'CEF116', '抗生素注射劑', '注射', 'vial', '用於嚴重細菌感染'),
('Vancomycin Injection 500mg', 'VAN117', '抗生素注射劑', '注射', 'vial', '用於MRSA感染'),
('Dopamine Injection 200mg/5ml', 'DOP118', '血管活性藥物', '注射', 'ml', '用於休克、低血壓'),
('Noradrenaline Injection 4mg/4ml', 'NOR119', '血管收縮劑', '注射', 'ml', '用於嚴重低血壓'),
('Potassium Chloride Injection 15%', 'POT120', '電解質補充劑', '注射', 'ml', '用於低鉀血症，需稀釋使用');

-- Update statistics
SELECT 
  administration_route,
  COUNT(*) as medication_count
FROM medication_drug_database 
WHERE administration_route IN ('外用', '注射', '滴眼')
GROUP BY administration_route
ORDER BY administration_route;