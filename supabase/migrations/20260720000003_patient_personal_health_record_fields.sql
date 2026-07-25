-- Migration: 院友個人及健康記錄擴充欄位
-- 日期: 2026-07-20
-- 用途: 對應 doc_html/院友個人及健康記錄P1.html 與 P2.html 的表單欄位

-- ─────────────────────────────────────────────
-- 1. 院友主表：獨立文字/日期欄位
-- ─────────────────────────────────────────────
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 通訊電話 VARCHAR(50);
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 通訊地址 TEXT;
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 教育程度 VARCHAR(50);
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 從前主要職業 VARCHAR(100);
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 宗教信仰 VARCHAR(50);
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 婚姻狀況 VARCHAR(50);
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 首次記錄職員姓名 VARCHAR(50);
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 首次記錄職級 VARCHAR(50);
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 首次記錄簽署 VARCHAR(50);
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS 首次記錄日期 DATE;

-- ─────────────────────────────────────────────
-- 2. 院友主表：JSONB 結構化欄位
-- ─────────────────────────────────────────────
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS social_status_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS medical_history_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS vaccination_records_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS medical_services_json JSONB DEFAULT '{}'::jsonb;

-- ─────────────────────────────────────────────
-- 3. 聯絡人表：身份證號碼
-- ─────────────────────────────────────────────
ALTER TABLE patient_contacts ADD COLUMN IF NOT EXISTS 身份證號碼 VARCHAR(20);

-- ─────────────────────────────────────────────
-- 4. 註釋
-- ─────────────────────────────────────────────
COMMENT ON COLUMN 院友主表.通訊電話 IS '院友通訊電話';
COMMENT ON COLUMN 院友主表.通訊地址 IS '院友通訊地址';
COMMENT ON COLUMN 院友主表.教育程度 IS '教育程度';
COMMENT ON COLUMN 院友主表.從前主要職業 IS '從前主要職業';
COMMENT ON COLUMN 院友主表.宗教信仰 IS '宗教信仰';
COMMENT ON COLUMN 院友主表.婚姻狀況 IS '婚姻狀況';
COMMENT ON COLUMN 院友主表.首次記錄職員姓名 IS '首次記錄職員姓名';
COMMENT ON COLUMN 院友主表.首次記錄職級 IS '首次記錄職級';
COMMENT ON COLUMN 院友主表.首次記錄簽署 IS '首次記錄簽署';
COMMENT ON COLUMN 院友主表.首次記錄日期 IS '首次記錄日期';
COMMENT ON COLUMN 院友主表.social_status_json IS '社交狀況（所用語言、經濟狀況、嗜好興趣、社交網絡、親友探訪）';
COMMENT ON COLUMN 院友主表.medical_history_json IS '病歷（疾病、骨折、手術、敏感歷史）';
COMMENT ON COLUMN 院友主表.vaccination_records_json IS '疫苗注射記錄（4次）';
COMMENT ON COLUMN 院友主表.medical_services_json IS '現正接受醫療服務及覆診機構';
COMMENT ON COLUMN patient_contacts.身份證號碼 IS '聯絡人身份證號碼';
