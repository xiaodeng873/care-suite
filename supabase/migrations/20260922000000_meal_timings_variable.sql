-- 服用時段可增減：新增 meal_timings jsonb（無上限時段 + 每個縫位各自連接詞）
-- 形狀：{"slots":["餐前","睡前"],"connectors":["或"]}，connectors 長度 = slots 長度 - 1
-- 舊三欄（meal_timing / meal_timing_2 / meal_timing_connector）保留，
-- 前端寫入時會同步舊欄（首兩個時段 + 首個連接詞）作兼容

BEGIN;

ALTER TABLE new_medication_prescriptions
    ADD COLUMN IF NOT EXISTS meal_timings jsonb;
COMMENT ON COLUMN new_medication_prescriptions.meal_timings IS '服用時段（可增減）：{"slots":[...],"connectors":[...]}，connectors 長度 = slots-1；「或」=任一時段給服皆合處方要求，「及」=該縫位兩時段皆需給服';

ALTER TABLE medication_drug_database
    ADD COLUMN IF NOT EXISTS meal_timings jsonb;
COMMENT ON COLUMN medication_drug_database.meal_timings IS '預設服用時段（可增減），新增處方時自動帶入；形狀同處方表';

-- 回填：處方表（時段1 欄名 meal_timing）
UPDATE new_medication_prescriptions
SET meal_timings = jsonb_build_object(
    'slots', CASE
        WHEN meal_timing_2 IS NOT NULL AND btrim(meal_timing_2) <> ''
            THEN jsonb_build_array(meal_timing, meal_timing_2)
        ELSE jsonb_build_array(meal_timing)
    END,
    'connectors', CASE
        WHEN meal_timing_2 IS NOT NULL AND btrim(meal_timing_2) <> ''
            THEN jsonb_build_array(COALESCE(meal_timing_connector, '或'))
        ELSE '[]'::jsonb
    END
)
WHERE meal_timing IS NOT NULL AND btrim(meal_timing) <> ''
  AND meal_timings IS NULL;

-- 回填：藥物資料庫（時段1 欄名 meal_timing_1）
UPDATE medication_drug_database
SET meal_timings = jsonb_build_object(
    'slots', CASE
        WHEN meal_timing_2 IS NOT NULL AND btrim(meal_timing_2) <> ''
            THEN jsonb_build_array(meal_timing_1, meal_timing_2)
        ELSE jsonb_build_array(meal_timing_1)
    END,
    'connectors', CASE
        WHEN meal_timing_2 IS NOT NULL AND btrim(meal_timing_2) <> ''
            THEN jsonb_build_array(COALESCE(meal_timing_connector, '或'))
        ELSE '[]'::jsonb
    END
)
WHERE meal_timing_1 IS NOT NULL AND btrim(meal_timing_1) <> ''
  AND meal_timings IS NULL;

COMMIT;
