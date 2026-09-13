-- 在住院友高清相片（1600px JPEG 0.9，約300-500KB）
-- 日常頭像繼續用 院友相片（400px 壓縮版）；匯出餐卡/藥紙等文件時優先用高清版
-- 退住時由 DischargeModal 清空此欄，控制雲端儲存成本

ALTER TABLE "院友主表" ADD COLUMN IF NOT EXISTS "院友相片高清" TEXT;

COMMENT ON COLUMN "院友主表"."院友相片高清" IS '在住院友高清相片(1600px)，退住時清空';
