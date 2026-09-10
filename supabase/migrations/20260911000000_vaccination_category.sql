-- 疫苗記錄增加疫苗類別欄位（新增記錄時強制選擇：流感/肺炎鏈球菌/新冠/其他）
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS vaccine_category text;

COMMENT ON COLUMN vaccination_records.vaccine_category IS '疫苗類別：流感疫苗 / 肺炎鏈球菌疫苗 / 新冠疫苗 / 其他疫苗（打印時舊記錄冇類別會用疫苗名稱關鍵字推斷）';
