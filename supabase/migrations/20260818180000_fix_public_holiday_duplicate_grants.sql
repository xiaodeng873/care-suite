-- 修正公眾假期（PH/SH）系統發放行重複問題
-- 1) 清理現有重複的系統 grant 行，只保留最早建立的一筆
-- 2) 加入部分唯一索引，防止未來同一用戶同一假期出現多筆系統 grant
-- 3) 提供原子同步函數，避免「先刪後插」在併發時產生重複

-- =====================================================
-- 1) 清理重複
-- =====================================================
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, reference_public_holiday_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM user_public_holiday_details
  WHERE is_system = true
    AND detail_type = 'grant'
    AND reference_public_holiday_id IS NOT NULL
)
DELETE FROM user_public_holiday_details
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- =====================================================
-- 2) 防止重複的唯一索引
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ph_grant_unique
  ON user_public_holiday_details(user_id, reference_public_holiday_id)
  WHERE detail_type = 'grant' AND is_system = true;

-- =====================================================
-- 3) 原子同步函數
-- =====================================================
CREATE OR REPLACE FUNCTION sync_public_holiday_grants_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_type text;
  v_start date;
  v_today date;
BEGIN
  -- 讀取該用戶的公眾假期設定
  SELECT public_holiday_type, public_holiday_start_date
  INTO v_type, v_start
  FROM user_employment_details
  WHERE user_id = p_user_id;

  IF v_type IS NULL OR v_start IS NULL THEN
    RETURN;
  END IF;

  v_today := CURRENT_DATE;

  IF v_start > v_today THEN
    RETURN;
  END IF;

  -- 在同一交易內刪除舊系統 grant 並重新插入，避免併發競態
  DELETE FROM user_public_holiday_details
  WHERE user_id = p_user_id
    AND is_system = true
    AND detail_type = 'grant';

  INSERT INTO user_public_holiday_details (
    user_id,
    record_date,
    detail_type,
    days,
    remark,
    reference_public_holiday_id,
    expiry_date,
    is_system,
    created_by
  )
  SELECT
    p_user_id,
    date_trunc('month', ph.holiday_date)::date,
    'grant',
    1,
    ph.name,
    ph.id,
    (ph.holiday_date + INTERVAL '30 days')::date,
    true,
    NULL
  FROM public_holidays ph
  WHERE ph.type = v_type
    AND ph.holiday_date >= v_start
    AND ph.holiday_date <= v_today;
END;
$$;
