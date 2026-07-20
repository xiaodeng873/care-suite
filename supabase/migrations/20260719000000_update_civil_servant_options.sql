-- 更新院友主表「公務員」欄位選項：合併為「公務員/家屬」，新增「醫管局員工/家屬」
ALTER TABLE public."院友主表"
DROP CONSTRAINT IF EXISTS "院友主表_公務員_check";

-- 將舊選項遷移到新選項
UPDATE public."院友主表"
SET "公務員" = CASE
  WHEN "公務員" IN ('公務員本人', '公務員家屬') THEN '公務員/家屬'
  ELSE "公務員"
END;

-- 重新建立 CHECK 約束
ALTER TABLE public."院友主表"
ADD CONSTRAINT "院友主表_公務員_check"
CHECK ("公務員" IS NULL OR "公務員" IN ('公務員/家屬', '醫管局員工/家屬'));
