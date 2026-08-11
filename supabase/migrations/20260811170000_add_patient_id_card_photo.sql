-- 院友主表新增「身份證相片」欄：AI 助護身份證分析流程的身份證圖留檔
-- 存 base64 data URL，與「院友相片」同一慣例
ALTER TABLE "院友主表" ADD COLUMN IF NOT EXISTS "身份證相片" text;

COMMENT ON COLUMN "院友主表"."身份證相片" IS '身份證圖留檔（base64 data URL，由 AI 助護身份證分析流程寫入）';
