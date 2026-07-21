-- Migration: 院友護理評估記錄擴充欄位
-- 日期: 2026-07-24
-- 用途: 對應 doc_html/院友護理評估記錄.html 的表單欄位

ALTER TABLE 院友主表 ADD COLUMN IF NOT EXISTS nursing_assessment_json JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN 院友主表.nursing_assessment_json IS '護理評估記錄（一般情況、精神狀況、情緒、體格、皮膚、視力聽覺、表達、飲食、牙齒、排泄、活動、傷殘、自我照顧、評估員）';
