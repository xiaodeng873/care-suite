/*
  # 入住記錄日誌（patient_stay_log）

  院友入住相關事件嘅獨立 log 表，結構同 bed_transfer_log 同款。
  院友主表.入住類型 保留做「現時類型」cache，所有消費方唔郁。

  1. 新表 patient_stay_log（一院友對多筆事件）
    - event_type：入住 / 類型變更 / 退住 / 床位調動
    - event_date 全部手動輸入（可為未來日期）
    - from_type / to_type：入住類型值（私位/買位/院舍券級別0/院舍券級別1-7/暫住）
    - applied：未來日期嘅類型變更=false，到期由 app 套用後=true；其他事件一律 true
    - actor_* 去正規化，照 bed_transfer_log

  2. RLS：tenant_isolation（authenticated）＋ Allow all access（anon，自訂認證必需）

  3. facility_id 冗余欄位，BEFORE INSERT trigger 由院友主表自動填入
     （set_facility_id_from_patient 已存在，見 20260904100000_multi_tenant_facility_id.sql）

  4. 全手動記錄：冇任何自動寫入 trigger。床位調動由 app 層手動寫入（用戶揀日期），
     唔再由 bed_transfer_log trigger 複製——自動記錄一旦冇及時更新，日期就會唔準確。

  5. Backfill（兩段，全部 NOT EXISTS 防重複，可安全重跑）：
     只回填入住/退住（主表嘅入住日期/退住日期係人手維護，準確）；
     唔回填 bed_transfer_log 歷史床位調動。
*/

-- ─────────────────────────────────────────────
-- 1. 建表
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_stay_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  facility_id integer REFERENCES facilities(id),
  event_type text NOT NULL CHECK (event_type IN ('入住', '類型變更', '退住', '床位調動')),
  event_date date NOT NULL,
  from_type text CHECK (from_type IS NULL OR from_type IN ('私位', '買位', '院舍券級別0', '院舍券級別1-7', '暫住')),
  to_type text CHECK (to_type IS NULL OR to_type IN ('私位', '買位', '院舍券級別0', '院舍券級別1-7', '暫住')),
  bed_action text,
  from_bed_number text,
  to_bed_number text,
  applied boolean NOT NULL DEFAULT true,
  actor_user_id uuid,
  actor_username text,
  actor_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_stay_log_patient_event_date ON patient_stay_log(patient_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_patient_stay_log_due_type_changes ON patient_stay_log(event_date)
  WHERE event_type = '類型變更' AND applied = false;

COMMENT ON TABLE patient_stay_log IS '院友入住記錄日誌：入住 / 類型變更 / 退住 / 床位調動事件；院友主表.入住類型 為現時類型 cache';
COMMENT ON COLUMN patient_stay_log.applied IS '類型變更專用：預選未來日期時為 false，到期套用後改 true；其他事件類型一律 true';

-- ─────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────
ALTER TABLE patient_stay_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON patient_stay_log;
CREATE POLICY "tenant_isolation" ON patient_stay_log FOR ALL TO authenticated
  USING ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id())
  WITH CHECK ((public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id = public.jwt_facility_id());

-- 自訂認證（web 端走 anon role）需要此策略
DROP POLICY IF EXISTS "Allow all access" ON patient_stay_log;
CREATE POLICY "Allow all access" ON patient_stay_log FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 3. facility_id 自動填入 trigger
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_set_facility_patient_stay_log ON patient_stay_log;
CREATE TRIGGER trg_set_facility_patient_stay_log BEFORE INSERT ON patient_stay_log
  FOR EACH ROW EXECUTE FUNCTION set_facility_id_from_patient('($1).patient_id');

-- ─────────────────────────────────────────────
-- 5. Backfill（idempotent：全部用 NOT EXISTS 防重複）
-- ─────────────────────────────────────────────

-- 5a. 現有院友有入住日期或入住類型 → 「入住」row（冇入住日期就用今日）
-- 注意：enum 改名（卷→券）喺 000001 先執行，呢度要即場轉譯舊值
INSERT INTO patient_stay_log (patient_id, event_type, event_date, to_type, applied, notes)
SELECT p."院友id", '入住', COALESCE(p."入住日期", CURRENT_DATE),
       REPLACE(p."入住類型"::text, '院舍卷', '院舍券'), true, 'migration 回填'
FROM "院友主表" p
WHERE (p."入住日期" IS NOT NULL OR p."入住類型" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM patient_stay_log l
    WHERE l.patient_id = p."院友id" AND l.event_type = '入住'
  );

-- 5b. 有退住日期 → 加插「退住」row（同樣即場轉譯舊 enum 值）
INSERT INTO patient_stay_log (patient_id, event_type, event_date, from_type, applied, notes)
SELECT p."院友id", '退住', p."退住日期",
       REPLACE(p."入住類型"::text, '院舍卷', '院舍券'), true, 'migration 回填'
FROM "院友主表" p
WHERE p."退住日期" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM patient_stay_log l
    WHERE l.patient_id = p."院友id" AND l.event_type = '退住'
  );
