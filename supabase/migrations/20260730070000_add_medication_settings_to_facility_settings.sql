-- 補上 facility_settings.medication_settings 欄位，供藥物設定面板儲存與讀取。
-- 若欄位已存在則不報錯。
ALTER TABLE public.facility_settings
ADD COLUMN IF NOT EXISTS medication_settings jsonb;

-- 確保既有單列資料至少有一個空的 JSON 物件，避免讀取時拿到 null。
UPDATE public.facility_settings
SET medication_settings = COALESCE(medication_settings, '{}'::jsonb)
WHERE id = 1;
