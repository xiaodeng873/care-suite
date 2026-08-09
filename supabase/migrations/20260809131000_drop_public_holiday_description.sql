-- 移除公眾假期描述欄位（僱傭詳情已不再使用）
ALTER TABLE user_employment_details
  DROP COLUMN IF EXISTS public_holiday_description;
