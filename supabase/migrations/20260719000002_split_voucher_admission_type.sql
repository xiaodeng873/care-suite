-- 拆分院舍卷為級別0和級別1-7
-- 級別0：維持原有豁免資格
-- 級別1-7：CGAT 收費等同自費，但身份代號仍為院舍卷

-- 先重命名舊值
ALTER TYPE public.admission_type_enum RENAME VALUE '院舍卷' TO '院舍卷級別0';

-- 新增級別1-7
ALTER TYPE public.admission_type_enum ADD VALUE '院舍卷級別1-7';

-- 更新現有資料（舊的 '院舍卷' 已自動改名，此處為保險）
UPDATE public."院友主表"
SET "入住類型" = '院舍卷級別0'
WHERE "入住類型"::text = '院舍卷';
