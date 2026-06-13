-- ============================================================
-- 修正 medication_drug_database 的重複 drug_code 問題
-- 在執行主要 INSERT 語句之後執行此腳本
-- ============================================================

-- ============================================================
-- 一、相同代碼但完全不同藥物 → 全部刪除，相關藥物改為 NULL 等候重新編號
-- ============================================================

-- ① BUPR09：Buprenorphine 20mcg 止痛貼 vs BUPROPION HCL 抗抑鬱藥（截然不同！）
--   注意：Buprenorphine 20mcg 已有正確代碼 BUPR03，故兩者皆刪除
DELETE FROM public.medication_drug_database
WHERE drug_code = 'BUPR09';

INSERT INTO public.medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes)
VALUES ('BUPROPION HCL (WELLBUTRIN XL) EXTENDED RELEASE TAB 300MG', NULL, '西藥', '口服', '粒', NULL)
ON CONFLICT DO NOTHING;

-- ② PALI07：Paliperidone palmitate inj 150mg/1.5ml（注射）vs Paliperidone Extended Release Tab 6mg（口服）
--   注射劑與口服片是不同藥物，兩者皆刪除，重新分配代碼
DELETE FROM public.medication_drug_database
WHERE drug_code = 'PALI07';

INSERT INTO public.medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes)
VALUES ('Paliperidone palmitate inj 150mg/1.5ml(1M)', NULL, '西藥', '注射', '支', '長效抗思覺失調針劑'),
       ('Paliperidone Extended Release Tab 6mg',       NULL, '西藥', '口服', '粒', NULL)
ON CONFLICT DO NOTHING;

-- ③ PARA04：Paracetamol 500mg+Orphenadrine Citrate 35mg tab（口服）vs Paracetamol rectal suppository 250mg（肛門栓）
--   成分與劑型完全不同，兩者皆刪除，重新分配代碼
DELETE FROM public.medication_drug_database
WHERE drug_code = 'PARA04';

INSERT INTO public.medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes)
VALUES ('Paracetamol 500mg+Orphenadrine Citrate 35mg tab', NULL, '西藥', '口服', '粒', '止痛藥、放鬆肌肉藥'),
       ('Paracetamol rectal suppository 250mg',            NULL, '西藥', '外用', '粒', NULL)
ON CONFLICT DO NOTHING;

-- ④ VORT01：Vortioxetine FC tablet 10mg vs VORTIOXETINE (HBR) TABLET 5mg（不同劑量，視為不同藥）
--   兩者皆刪除，重新分配代碼
DELETE FROM public.medication_drug_database
WHERE drug_code = 'VORT01';

INSERT INTO public.medication_drug_database (drug_name, drug_code, drug_type, administration_route, unit, notes)
VALUES ('Vortioxetine FC tablet 10mg',    NULL, '西藥', '口服', '粒', '抗抑鬱藥'),
       ('VORTIOXETINE (HBR) TABLET 5MG',  NULL, '西藥', '口服', '粒', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 二、相同藥物但名稱不同 → 以 drug1（第一筆）為準，UPDATE 回正確名稱
--   （ON CONFLICT DO UPDATE 導致最後一筆覆蓋，故需手動修正）
-- ============================================================

-- LACT05：保留 'LACTULOSE LIQUID'（unit: 毫升），刪除 'Lactulose liq 3.3g/5ml (100ml)'（unit: 支）
UPDATE public.medication_drug_database
SET drug_name = 'LACTULOSE LIQUID',
    unit = '毫升'
WHERE drug_code = 'LACT05';

-- SENN01：保留 'SENNA TABLET 7.5MG'
UPDATE public.medication_drug_database
SET drug_name = 'SENNA TABLET 7.5MG'
WHERE drug_code = 'SENN01';

-- TRIF02：保留 'Trifluoperazine HCl tab 5mg'
UPDATE public.medication_drug_database
SET drug_name = 'Trifluoperazine HCl tab 5mg'
WHERE drug_code = 'TRIF02';

-- ============================================================
-- 三、完全重複（QUET01）→ ON CONFLICT DO UPDATE 已自動保留一筆，無需操作
-- ============================================================

-- ============================================================
-- 驗證結果（可選擇執行）
-- ============================================================
-- SELECT drug_code, drug_name, administration_route, unit
-- FROM public.medication_drug_database
-- WHERE drug_code IN ('BUPR09','PALI07','PARA04','VORT01','LACT05','SENN01','TRIF02','QUET01')
--    OR drug_name ILIKE '%BUPROPION%'
--    OR drug_name ILIKE '%paliperidone extended%'
--    OR drug_name ILIKE '%suppository%'
--    OR drug_name ILIKE '%VORTIOXETINE (HBR)%'
-- ORDER BY drug_code NULLS LAST, drug_name;
