-- 藥物資料庫新增「不可與中和胃酸藥同服」旗標
-- 顯示端（eMAR／HTML藥紙）以藥物名稱對照藥物資料庫取得旗標，
-- 旗標以藥物資料庫為單一來源，不再複製到處方表。

ALTER TABLE medication_drug_database
ADD COLUMN IF NOT EXISTS no_antacid boolean DEFAULT false;

COMMENT ON COLUMN medication_drug_database.no_antacid IS '藥物是否不可與中和胃酸藥同服（true = 不可同服）';
