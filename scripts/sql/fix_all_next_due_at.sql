-- fix_all_next_due_at.sql
-- 一次性為所有 is_recurring=true 且 last_completed_at IS NOT NULL 的任務
-- 用「逐日掃描健康記錄」的正確邏輯重算 next_due_at（及 last_completed_at）
-- 執行方式：supabase db query --linked "$(cat fix_all_next_due_at.sql)"
--
-- 兩個 bug 的根源：
--   1. Timezone bug：toISOString() 回傳 UTC 日期，在 HK(+8) 比本地日期早一天
--   2. Patient-fallback bug：查詢時包含其他任務的同類型記錄，導致掃描跳過數十天
-- 此腳本以「任務 ID 精確匹配 + 無 ID 舊記錄後備」正確實現 findFirstMissingDate 邏輯

DO $$
DECLARE
  t            RECORD;
  start_d      DATE;
  check_d      DATE;
  found_d      DATE;
  found_t      TEXT;
  def_t        TEXT;
  is_sched     BOOL;
  c_dow        INT;
  d_cnt        INT;
  all_done     BOOL;
  new_next_ts  TIMESTAMPTZ;
  new_last_ts  TIMESTAMPTZ;
  rec_dates    DATE[];
  rec_hhmm     TEXT[];
  r_cnt        BIGINT;
  j            INT;
  time_found   BOOL;
  i            INT;
  st           TEXT;
  latest_d     DATE;
  latest_hhmm  TEXT;
  updated_cnt  INT := 0;
BEGIN
  FOR t IN
    SELECT id, patient_id, health_record_type,
           frequency_unit, frequency_value,
           specific_times, specific_days_of_week, specific_days_of_month,
           last_completed_at, next_due_at, created_at
    FROM patient_health_tasks
    WHERE last_completed_at IS NOT NULL
      AND is_recurring = true
  LOOP

    -- ── 預設時間點 ──────────────────────────────────────────────────────
    def_t := CASE WHEN jsonb_array_length(t.specific_times) > 0
                  THEN LEFT(t.specific_times ->> 0, 5)
                  ELSE '08:00' END;

    -- ── Step 1：取此任務的「最後一筆記錄」（精確匹配 + null-id 後備）──
    SELECT h.記錄日期, TO_CHAR(h.記錄時間, 'HH24:MI')
    INTO   latest_d, latest_hhmm
    FROM   健康監測記錄 h
    WHERE  (   h.任務id = t.id
            OR (h.任務id IS NULL
                AND h.院友id = t.patient_id
                AND h.監測類型::TEXT = t.health_record_type::TEXT))
    ORDER  BY h.記錄日期 DESC, h.記錄時間 DESC
    LIMIT  1;

    IF latest_d IS NULL THEN CONTINUE; END IF;   -- 無記錄則跳過

    -- ── Step 2：掃描起點 = 最後記錄日 - 14 天 ─────────────────────────
    start_d := latest_d - 14;

    -- ── Step 3：批次讀取掃描範圍內所有相關記錄（精確匹配）───────────────
    SELECT ARRAY_AGG(rec_d ORDER BY rec_d, rec_hm),
           ARRAY_AGG(rec_hm ORDER BY rec_d, rec_hm),
           COUNT(*)
    INTO   rec_dates, rec_hhmm, r_cnt
    FROM   (
      SELECT h.記錄日期                       AS rec_d,
             TO_CHAR(h.記錄時間, 'HH24:MI')  AS rec_hm
      FROM   健康監測記錄 h
      WHERE  h.記錄日期 BETWEEN start_d AND (start_d + 60)
        AND  (   h.任務id = t.id
              OR (h.任務id IS NULL
                  AND h.院友id = t.patient_id
                  AND h.監測類型::TEXT = t.health_record_type::TEXT))
    ) sub;

    -- ── Step 4：逐日掃描，找第一個未完成日期 ────────────────────────────
    check_d := start_d;
    found_d := NULL;
    found_t := NULL;
    d_cnt   := 0;

    <<scan_loop>>
    WHILE d_cnt < 60 LOOP

      -- 判斷當天是否排程
      is_sched := FALSE;
      CASE t.frequency_unit
        WHEN 'daily' THEN
          is_sched := TRUE;
        WHEN 'weekly' THEN
          IF jsonb_array_length(t.specific_days_of_week) > 0 THEN
            c_dow    := CASE EXTRACT(DOW FROM check_d)::INT
                          WHEN 0 THEN 7
                          ELSE EXTRACT(DOW FROM check_d)::INT END;
            is_sched := t.specific_days_of_week @> to_jsonb(c_dow);
          END IF;
        WHEN 'monthly' THEN
          IF jsonb_array_length(t.specific_days_of_month) > 0 THEN
            is_sched := t.specific_days_of_month
                        @> to_jsonb(EXTRACT(DAY FROM check_d)::INT);
          END IF;
        ELSE NULL;
      END CASE;

      -- 任務建立日期前不算已排程
      IF is_sched AND t.created_at IS NOT NULL
         AND check_d < DATE(t.created_at AT TIME ZONE 'Asia/Hong_Kong') THEN
        is_sched := FALSE;
      END IF;

      IF is_sched THEN
        IF jsonb_array_length(t.specific_times) > 0 THEN
          -- 多時間點任務：逐一時間點檢查
          all_done := TRUE;
          i := 0;
          WHILE i < jsonb_array_length(t.specific_times) LOOP
            st         := LEFT(t.specific_times ->> i, 5);
            time_found := FALSE;
            IF r_cnt > 0 THEN
              FOR j IN 1..r_cnt LOOP
                IF rec_dates[j] = check_d AND rec_hhmm[j] = st THEN
                  time_found := TRUE;
                  EXIT;
                END IF;
              END LOOP;
            END IF;
            IF NOT time_found THEN
              all_done := FALSE;
              found_d  := check_d;
              found_t  := st;
              EXIT;        -- 離開 inner WHILE（進入 IF NOT all_done 判斷）
            END IF;
            i := i + 1;
          END LOOP;
          IF NOT all_done THEN EXIT scan_loop; END IF;

        ELSE
          -- 無指定時間點：只要當天有記錄即算完成
          time_found := FALSE;
          IF r_cnt > 0 THEN
            FOR j IN 1..r_cnt LOOP
              IF rec_dates[j] = check_d THEN
                time_found := TRUE;
                EXIT;
              END IF;
            END LOOP;
          END IF;
          IF NOT time_found THEN
            found_d := check_d;
            found_t := def_t;
            EXIT scan_loop;
          END IF;
        END IF;
      END IF;

      check_d := check_d + 1;
      d_cnt   := d_cnt   + 1;
    END LOOP scan_loop;

    -- 60 天內全部完成 → 下一個排程日
    IF found_d IS NULL THEN
      found_d := check_d;
      found_t := def_t;
    END IF;

    -- ── Step 5：組合時間戳並更新 ────────────────────────────────────────
    new_next_ts := (found_d::TEXT  || ' ' || found_t)::TIMESTAMP
                    AT TIME ZONE 'Asia/Hong_Kong';
    new_last_ts := (latest_d::TEXT || ' ' || latest_hhmm)::TIMESTAMP
                    AT TIME ZONE 'Asia/Hong_Kong';

    IF new_next_ts IS DISTINCT FROM t.next_due_at
       OR new_last_ts IS DISTINCT FROM t.last_completed_at THEN
      UPDATE patient_health_tasks
      SET    next_due_at      = new_next_ts,
             last_completed_at = new_last_ts
      WHERE  id = t.id;
      updated_cnt := updated_cnt + 1;
    END IF;

  END LOOP;  -- 任務迴圈

  RAISE NOTICE '✅ next_due_at / last_completed_at 修正完成，共更新 % 個任務', updated_cnt;
END $$;
