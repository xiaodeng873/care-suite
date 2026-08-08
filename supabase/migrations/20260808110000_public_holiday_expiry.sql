-- 公眾假期（PH/SH）改為按單一假期發放，並設 30 天有效期
-- 1) 為 user_public_holiday_details 增加 reference_public_holiday_id 與 expiry_date
-- 2) 清理由舊「每月聚合」產生的系統 grant，讓 EmploymentDetailsSection 下次載入時按新規則重建

ALTER TABLE user_public_holiday_details
  ADD COLUMN IF NOT EXISTS reference_public_holiday_id uuid,
  ADD COLUMN IF NOT EXISTS expiry_date date;

-- 外鍵關聯 public_holidays，放假對象刪除時設為 NULL（不強制，因 usage/writeoff 可為 null）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_public_holiday_details_reference_public_holiday_id_fkey'
  ) THEN
    ALTER TABLE user_public_holiday_details
      ADD CONSTRAINT user_public_holiday_details_reference_public_holiday_id_fkey
      FOREIGN KEY (reference_public_holiday_id) REFERENCES public_holidays(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_public_holiday_details_expiry
  ON user_public_holiday_details(expiry_date);
CREATE INDEX IF NOT EXISTS idx_user_public_holiday_details_reference
  ON user_public_holiday_details(reference_public_holiday_id);

-- 移除舊版每月聚合的系統發放行，讓它們下次被 lazy 重建為每個假期獨立一行
DELETE FROM user_public_holiday_details
WHERE is_system = true AND detail_type = 'grant';
