-- 院友主表：身份證簽發日期（選填，顯示於身份證號碼下方）

ALTER TABLE "院友主表" ADD COLUMN IF NOT EXISTS "身份證簽發日期" date;
COMMENT ON COLUMN "院友主表"."身份證簽發日期" IS '香港身份證簽發日期（選填）';
