-- 修正有薪年假系統發放行重複問題
-- 1) 清理現有重複的系統 grant 行，只保留最早建立的一筆
-- 2) 加入部分唯一索引，防止未來同一用戶同一發放日出現多筆系統 grant
-- 3) 提供原子同步函數，避免「先刪後插」在併發時產生重複

-- =====================================================
-- 1) 清理重複
-- =====================================================
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, record_date
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM user_annual_leave_details
  WHERE is_system = true
    AND detail_type = 'grant'
)
DELETE FROM user_annual_leave_details
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- =====================================================
-- 2) 防止重複的唯一索引
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_al_grant_unique
  ON user_annual_leave_details(user_id, record_date)
  WHERE detail_type = 'grant' AND is_system = true;

-- =====================================================
-- 3) 月份加法（月底截斷）
-- =====================================================
CREATE OR REPLACE FUNCTION add_months_clamped(d date, months int)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  y int;
  m int;
  day int;
  last_day int;
BEGIN
  y := EXTRACT(YEAR FROM d)::int;
  m := EXTRACT(MONTH FROM d)::int;
  day := EXTRACT(DAY FROM d)::int;

  m := m + months;
  y := y + FLOOR((m - 1)::float / 12)::int;
  m := ((m - 1) % 12) + 1;

  last_day := EXTRACT(DAY FROM (make_date(y, m, 1) + INTERVAL '1 month - 1 day'))::int;
  RETURN make_date(y, m, LEAST(day, last_day));
END;
$$;

-- =====================================================
-- 4) 原子同步函數
-- =====================================================
CREATE OR REPLACE FUNCTION sync_annual_leave_grants_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_start date;
  v_y numeric;
  v_today date;
  v_m int := 0;
  v_k int;
  v_record_date date;
  v_days numeric;
BEGIN
  -- 讀取該用戶的年假設定
  SELECT annual_leave_start_date, annual_leave_days_per_year
  INTO v_start, v_y
  FROM user_employment_details
  WHERE user_id = p_user_id;

  IF v_start IS NULL OR v_y IS NULL OR v_y <= 0 THEN
    RETURN;
  END IF;

  v_today := CURRENT_DATE;

  IF v_start > v_today THEN
    RETURN;
  END IF;

  -- 在同一交易內刪除舊系統 grant 並重新插入
  DELETE FROM user_annual_leave_details
  WHERE user_id = p_user_id
    AND is_system = true
    AND detail_type = 'grant';

  -- 計算最大完整受僱月數 m（使第 m+1 個受僱日 > today）
  WHILE add_months_clamped(v_start, v_m + 1) <= v_today LOOP
    v_m := v_m + 1;
  END LOOP;

  FOR v_k IN 3..v_m LOOP
    IF v_k = 3 THEN
      v_days := ROUND((v_y * 3) / 12 * 2) / 2;
    ELSIF v_k < 12 THEN
      v_days := ROUND((v_y * v_k) / 12 * 2) / 2
                - ROUND((v_y * (v_k - 1)) / 12 * 2) / 2;
    ELSIF v_k % 12 = 0 THEN
      IF v_k = 12 THEN
        v_days := v_y - ROUND((v_y * 11) / 12 * 2) / 2;
      ELSE
        v_days := v_y;
      END IF;
    ELSE
      CONTINUE;
    END IF;

    IF v_days > 0 THEN
      v_record_date := add_months_clamped(v_start, v_k);
      INSERT INTO user_annual_leave_details (
        user_id,
        record_date,
        detail_type,
        days,
        remark,
        is_system,
        created_by
      ) VALUES (
        p_user_id,
        v_record_date,
        'grant',
        v_days,
        '系統自動發放',
        true,
        NULL
      );
    END IF;
  END LOOP;
END;
$$;
