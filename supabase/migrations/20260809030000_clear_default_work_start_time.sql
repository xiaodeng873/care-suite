-- 把「預設上班時間」改為「特定上班時間」（常態化 availability）
-- 先清空全部現有值，由用戶重新按需設定
UPDATE public.user_employment_details
SET default_work_start_time = NULL,
    updated_at = NOW();

COMMENT ON COLUMN public.user_employment_details.default_work_start_time IS '員工特定上班時間（HH:MM）。有填寫時視為強制可用時段，班次必須落在 [default_work_start_time, default_work_start_time + daily_contract_hours] 內；未設定則無限制。';
