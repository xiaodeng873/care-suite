-- 新增個案會議相關欄位到 care_plans 表
-- 創建日期: 2025-12-27

-- 新增個案會議日期欄位
ALTER TABLE care_plans 
ADD COLUMN IF NOT EXISTS case_conference_date DATE;

-- 新增個案會議專業人員JSON欄位（儲存各專業的評估者和評估日期）
ALTER TABLE care_plans 
ADD COLUMN IF NOT EXISTS case_conference_professionals JSONB DEFAULT '[]';

-- 新增家屬聯絡日期欄位
ALTER TABLE care_plans 
ADD COLUMN IF NOT EXISTS family_contact_date DATE;

-- 新增家屬姓名欄位
ALTER TABLE care_plans 
ADD COLUMN IF NOT EXISTS family_member_name TEXT;

-- 新增索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_care_plans_case_conference_date 
ON care_plans(case_conference_date);

-- 新增註解說明
COMMENT ON COLUMN care_plans.case_conference_date IS '個案會議日期';
COMMENT ON COLUMN care_plans.case_conference_professionals IS '各專業評估者和評估日期 (JSON array)';
COMMENT ON COLUMN care_plans.family_contact_date IS '聯絡家屬/報告日期';
COMMENT ON COLUMN care_plans.family_member_name IS '院友家屬姓名';
