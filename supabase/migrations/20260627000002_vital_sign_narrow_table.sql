-- ============================================================
-- Migration: 健康監測記錄 Narrow Table
-- 2026-06-27
--
-- 改動概要：
--   1. 新增 7 種獨立生命表徵類型至 health_task_type enum
--   2. 建立 narrow table「健康監測記錄」（每 row = 1 種量度）
--   3. 從「健康記錄主表」遷移所有歷史資料
--   4. 展開 patient_health_tasks 的「生命表徵」任務為 5 筆獨立任務
--   5. 重建 health_task_type enum，移除廢棄值（生命表徵/血糖控制/體重控制）
--      PostgreSQL 不提供 DROP VALUE，故以 RENAME + 重建 + 遷移欄位 + DROP 完成
--   6. 廢棄「健康記錄主表」、「deleted_health_records」及「記錄類型」enum
--   7. 建立「健康監測_會話視圖」（桌面 Session 合併行顯示用）
-- ============================================================

-- ─── Step 1（在 20260627000001 完成，已提交）─────────────────
-- 7 個新 enum 值已在上一個 migration 提交，此處可直接使用。

-- ─── Step 2: 建立 narrow 健康監測記錄 table ───────────────────
CREATE TABLE 健康監測記錄 (
  記錄id   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  院友id   INT              NOT NULL REFERENCES 院友主表(院友id) ON DELETE CASCADE,
  任務id   UUID             REFERENCES patient_health_tasks(id) ON DELETE SET NULL,
  記錄日期 DATE             NOT NULL,
  記錄時間 TIME             NOT NULL,
  監測類型 health_task_type NOT NULL,
  數值     DECIMAL(6,2)     NOT NULL,
  數值_副  DECIMAL(6,2),                        -- 僅血壓舒張壓使用，其餘 NULL
  備註     TEXT,
  記錄人員 VARCHAR(50),
  建立時間 TIMESTAMPTZ      DEFAULT now(),
  CONSTRAINT 監測類型_限定 CHECK (
    監測類型 IN ('血壓','脈搏','體溫','血含氧量','呼吸','血糖值','體重')
  )
);

CREATE INDEX idx_健康監測記錄_院友id       ON 健康監測記錄(院友id);
CREATE INDEX idx_健康監測記錄_日期         ON 健康監測記錄(記錄日期);
CREATE INDEX idx_健康監測記錄_院友日期時間 ON 健康監測記錄(院友id, 記錄日期, 記錄時間);
CREATE INDEX idx_健康監測記錄_監測類型     ON 健康監測記錄(監測類型);
CREATE INDEX idx_健康監測記錄_任務id       ON 健康監測記錄(任務id);

ALTER TABLE 健康監測記錄 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允許已認證用戶管理健康監測記錄"
  ON 健康監測記錄 FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── Step 3: 遷移「健康記錄主表」歷史資料 ────────────────────
-- 3a 血壓（收縮壓 + 舒張壓 均有值）
INSERT INTO 健康監測記錄 (院友id, 記錄日期, 記錄時間, 監測類型, 數值, 數值_副, 備註, 記錄人員)
SELECT 院友id, 記錄日期, 記錄時間, '血壓'::health_task_type,
       血壓收縮壓, 血壓舒張壓, 備註, 記錄人員
FROM   健康記錄主表
WHERE  記錄類型::text = '生命表徵'
  AND  血壓收縮壓 IS NOT NULL
  AND  血壓舒張壓 IS NOT NULL;

-- 3b 血壓（僅收縮壓有值）
INSERT INTO 健康監測記錄 (院友id, 記錄日期, 記錄時間, 監測類型, 數值, 備註, 記錄人員)
SELECT 院友id, 記錄日期, 記錄時間, '血壓'::health_task_type,
       血壓收縮壓, 備註, 記錄人員
FROM   健康記錄主表
WHERE  記錄類型::text = '生命表徵'
  AND  血壓收縮壓 IS NOT NULL
  AND  血壓舒張壓 IS NULL;

-- 3c 脈搏
INSERT INTO 健康監測記錄 (院友id, 記錄日期, 記錄時間, 監測類型, 數值, 備註, 記錄人員)
SELECT 院友id, 記錄日期, 記錄時間, '脈搏'::health_task_type,
       脈搏, 備註, 記錄人員
FROM   健康記錄主表
WHERE  記錄類型::text = '生命表徵'
  AND  脈搏 IS NOT NULL;

-- 3d 體溫
INSERT INTO 健康監測記錄 (院友id, 記錄日期, 記錄時間, 監測類型, 數值, 備註, 記錄人員)
SELECT 院友id, 記錄日期, 記錄時間, '體溫'::health_task_type,
       體溫, 備註, 記錄人員
FROM   健康記錄主表
WHERE  記錄類型::text = '生命表徵'
  AND  體溫 IS NOT NULL;

-- 3e 血含氧量
INSERT INTO 健康監測記錄 (院友id, 記錄日期, 記錄時間, 監測類型, 數值, 備註, 記錄人員)
SELECT 院友id, 記錄日期, 記錄時間, '血含氧量'::health_task_type,
       血含氧量, 備註, 記錄人員
FROM   健康記錄主表
WHERE  記錄類型::text = '生命表徵'
  AND  血含氧量 IS NOT NULL;

-- 3f 呼吸
INSERT INTO 健康監測記錄 (院友id, 記錄日期, 記錄時間, 監測類型, 數值, 備註, 記錄人員)
SELECT 院友id, 記錄日期, 記錄時間, '呼吸'::health_task_type,
       呼吸頻率, 備註, 記錄人員
FROM   健康記錄主表
WHERE  記錄類型::text = '生命表徵'
  AND  呼吸頻率 IS NOT NULL;

-- 3g 血糖值
INSERT INTO 健康監測記錄 (院友id, 記錄日期, 記錄時間, 監測類型, 數值, 備註, 記錄人員)
SELECT 院友id, 記錄日期, 記錄時間, '血糖值'::health_task_type,
       血糖值, 備註, 記錄人員
FROM   健康記錄主表
WHERE  記錄類型::text = '血糖控制'
  AND  血糖值 IS NOT NULL;

-- 3h 體重
INSERT INTO 健康監測記錄 (院友id, 記錄日期, 記錄時間, 監測類型, 數值, 備註, 記錄人員)
SELECT 院友id, 記錄日期, 記錄時間, '體重'::health_task_type,
       體重, 備註, 記錄人員
FROM   健康記錄主表
WHERE  記錄類型::text = '體重控制'
  AND  體重 IS NOT NULL;

-- ─── Step 4: 遷移 patient_health_tasks ───────────────────────
-- 4a 展開「生命表徵」任務為 5 種獨立監測任務

-- 血壓
INSERT INTO patient_health_tasks (
  patient_id, health_record_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
)
SELECT
  patient_id, '血壓'::health_task_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
FROM patient_health_tasks
WHERE health_record_type::text = '生命表徵';

-- 脈搏
INSERT INTO patient_health_tasks (
  patient_id, health_record_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
)
SELECT
  patient_id, '脈搏'::health_task_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
FROM patient_health_tasks
WHERE health_record_type::text = '生命表徵';

-- 體溫
INSERT INTO patient_health_tasks (
  patient_id, health_record_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
)
SELECT
  patient_id, '體溫'::health_task_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
FROM patient_health_tasks
WHERE health_record_type::text = '生命表徵';

-- 血含氧量
INSERT INTO patient_health_tasks (
  patient_id, health_record_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
)
SELECT
  patient_id, '血含氧量'::health_task_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
FROM patient_health_tasks
WHERE health_record_type::text = '生命表徵';

-- 呼吸
INSERT INTO patient_health_tasks (
  patient_id, health_record_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
)
SELECT
  patient_id, '呼吸'::health_task_type, frequency_unit, frequency_value,
  specific_times, specific_days_of_week, specific_days_of_month,
  last_completed_at, next_due_at, notes, is_recurring,
  start_date, end_date, end_time
FROM patient_health_tasks
WHERE health_record_type::text = '生命表徵';

-- 4b 刪除原「生命表徵」任務（已展開完成）
DELETE FROM patient_health_tasks
WHERE health_record_type::text = '生命表徵';

-- 4c 血糖控制 → 血糖值
UPDATE patient_health_tasks
SET    health_record_type = '血糖值'::health_task_type
WHERE  health_record_type::text = '血糖控制';

-- 4d 體重控制 → 體重
UPDATE patient_health_tasks
SET    health_record_type = '體重'::health_task_type
WHERE  health_record_type::text = '體重控制';

-- ─── Step 5: 遷移完整性驗證（失敗則整體回滾）────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM patient_health_tasks
    WHERE  health_record_type::text IN ('生命表徵','血糖控制','體重控制')
  ) THEN
    RAISE EXCEPTION
      '遷移驗證失敗：patient_health_tasks 仍有廢棄監測類型（生命表徵/血糖控制/體重控制）';
  END IF;
END $$;

-- ─── Step 6: 重建 health_task_type，移除廢棄值 ───────────────
-- PostgreSQL 不支援 ALTER TYPE ... DROP VALUE，
-- 採用：RENAME 舊 → 建新（不含廢棄值）→ 遷移兩個欄位 → DROP 舊
--
-- 注意：ALTER COLUMN TYPE 時，CHECK constraint 的 IN 字面值會被
-- 解析為新 enum 類型，與欄位的舊 enum 類型產生 = 運算子衝突。
-- 需在 RENAME 前先 DROP constraint，ALTER COLUMN 後再重建。

ALTER TABLE 健康監測記錄 DROP CONSTRAINT 監測類型_限定;

ALTER TYPE health_task_type RENAME TO health_task_type_old;

CREATE TYPE health_task_type AS ENUM (
  -- 生命表徵（7 種獨立類型，取代原有的生命表徵/血糖控制/體重控制）
  '血壓', '脈搏', '體溫', '血含氧量', '呼吸', '血糖值', '體重',
  -- 護理任務
  '導尿管更換', '鼻胃飼管更換', '傷口換症', '氧氣喉管清洗/更換',
  -- 文件任務
  '約束物品同意書', '年度體檢', '藥物自存同意書', '晚晴計劃'
);

ALTER TABLE patient_health_tasks
  ALTER COLUMN health_record_type TYPE health_task_type
  USING health_record_type::text::health_task_type;

ALTER TABLE 健康監測記錄
  ALTER COLUMN 監測類型 TYPE health_task_type
  USING 監測類型::text::health_task_type;

DROP TYPE health_task_type_old;

-- 重建 CHECK constraint（使用清理後的新 enum 類型）
ALTER TABLE 健康監測記錄
  ADD CONSTRAINT 監測類型_限定 CHECK (
    監測類型 IN ('血壓','脈搏','體溫','血含氧量','呼吸','血糖值','體重')
  );

-- ─── Step 7: 廢棄舊表及相關型別 ──────────────────────────────
-- deleted_health_records 依賴 記錄類型 enum，需先廢棄
DROP TABLE IF EXISTS deleted_health_records;
DROP TABLE IF EXISTS 健康記錄主表;
DROP TYPE  IF EXISTS 記錄類型;

-- ─── Step 8: 建立會話視圖（桌面 Session 合併行）──────────────
-- 將同一 (院友, 日期, 時間, 任務) 的多筆 narrow rows 合併為一行，
-- 供前端直接渲染 Session 合併行（方案 A），無需前端 groupBy 邏輯。
CREATE OR REPLACE VIEW 健康監測_會話視圖 AS
SELECT
  r.院友id,
  p.中文姓名                                                          AS 院友姓名,
  p.床號                                                              AS 院友床號,
  r.記錄日期,
  r.記錄時間,
  r.任務id,
  jsonb_object_agg(
    r.監測類型::text,
    CASE r.監測類型::text
      WHEN '血壓' THEN jsonb_build_object('收縮壓', r.數值, '舒張壓', r.數值_副)
      ELSE             jsonb_build_object('值', r.數值)
    END
  )                                                                   AS 測量值組,
  string_agg(DISTINCT r.備註, '; ')
    FILTER (WHERE r.備註 IS NOT NULL)                                 AS 備註,
  MAX(r.記錄人員)                                                     AS 記錄人員,
  MIN(r.建立時間)                                                     AS 建立時間,
  array_agg(r.記錄id ORDER BY r.監測類型::text)                       AS 記錄id_列表
FROM  健康監測記錄 r
JOIN  院友主表 p ON r.院友id = p.院友id
GROUP BY r.院友id, p.中文姓名, p.床號, r.記錄日期, r.記錄時間, r.任務id;

GRANT SELECT ON 健康監測_會話視圖 TO authenticated;

-- 血壓完整性約束：血壓類型必須同時提供舒張壓（數值_副），防止只填收縮壓
ALTER TABLE 健康監測記錄
  ADD CONSTRAINT 血壓必須有舒張壓 CHECK (
    監測類型::text != '血壓' OR 數值_副 IS NOT NULL
  );

COMMENT ON TABLE 健康監測記錄
  IS 'Narrow table：每筆記錄一種量度，取代舊寬表 健康記錄主表';
COMMENT ON VIEW 健康監測_會話視圖
  IS '按(院友,日期,時間,任務)合併同一量度 session 的所有 narrow rows，供桌面表格 Session 合併行顯示';
