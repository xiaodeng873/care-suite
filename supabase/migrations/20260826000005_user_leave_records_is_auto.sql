ALTER TABLE public.user_leave_records ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_leave_records.is_auto IS 'true = 一鍵排假產生，可被重排；false = 用戶輸入，不可篡改';
