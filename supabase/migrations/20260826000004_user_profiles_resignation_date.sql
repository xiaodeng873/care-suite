-- 僱傭詳情：離職日期
-- 有離職日期時：帳戶自動停用、排班表與預排表於該日起不可再插入
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS resignation_date date;
