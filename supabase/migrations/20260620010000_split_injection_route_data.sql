/*
  # 拆分注射給藥途徑（資料遷移）

  背景：處方輸入的「服用途徑」已將「注射」拆成「肌肉注射」與「皮下注射」。
  本遷移把既有 administration_route = '注射' 的資料，依文字線索自動分流：
    - 含「皮下」或英文 SC / S.C. / S/C / subcut(aneous) → 皮下注射
    - 含「肌肉」或英文 IM / I.M. / intramuscular        → 肌肉注射
    - 無法判斷者保留原值「注射」，待人手處理。

  影響資料表：
    1. medication_prescriptions （處方表）
    2. medication_drug_database  （藥物主檔）

  比對欄位：各表的名稱欄、notes 與（處方表）dosage_form 串接後比對。
  英文關鍵字以「非英文字母邊界」框住，避免誤命中如 time(IM)、ascorbic(SC) 等子字串。
  本遷移為冪等：再次執行時只會處理仍為「注射」的列。
*/

BEGIN;

-- 1) 處方表：先分流「皮下」，再分流「肌肉」（已改動的列不會被第二步重複處理）
UPDATE medication_prescriptions
SET administration_route = '皮下注射',
    updated_at = now()
WHERE administration_route = '注射'
  AND (
    (coalesce(notes,'') || ' ' || coalesce(medication_name,'') || ' ' || coalesce(dosage_form,'')) LIKE '%皮下%'
    OR (coalesce(notes,'') || ' ' || coalesce(medication_name,'') || ' ' || coalesce(dosage_form,''))
        ~* '(^|[^[:alpha:]])(s[./]?c[./]?|subcut|subcutaneous)([^[:alpha:]]|$)'
  );

UPDATE medication_prescriptions
SET administration_route = '肌肉注射',
    updated_at = now()
WHERE administration_route = '注射'
  AND (
    (coalesce(notes,'') || ' ' || coalesce(medication_name,'') || ' ' || coalesce(dosage_form,'')) LIKE '%肌肉%'
    OR (coalesce(notes,'') || ' ' || coalesce(medication_name,'') || ' ' || coalesce(dosage_form,''))
        ~* '(^|[^[:alpha:]])(i[./]?m[./]?|intramuscular)([^[:alpha:]]|$)'
  );

-- 2) 藥物主檔：同樣規則（比對 drug_name 與 notes）
UPDATE medication_drug_database
SET administration_route = '皮下注射',
    updated_at = now()
WHERE administration_route = '注射'
  AND (
    (coalesce(notes,'') || ' ' || coalesce(drug_name,'')) LIKE '%皮下%'
    OR (coalesce(notes,'') || ' ' || coalesce(drug_name,''))
        ~* '(^|[^[:alpha:]])(s[./]?c[./]?|subcut|subcutaneous)([^[:alpha:]]|$)'
  );

UPDATE medication_drug_database
SET administration_route = '肌肉注射',
    updated_at = now()
WHERE administration_route = '注射'
  AND (
    (coalesce(notes,'') || ' ' || coalesce(drug_name,'')) LIKE '%肌肉%'
    OR (coalesce(notes,'') || ' ' || coalesce(drug_name,''))
        ~* '(^|[^[:alpha:]])(i[./]?m[./]?|intramuscular)([^[:alpha:]]|$)'
  );

-- 3) 列出仍無法判斷、保留為「注射」的資料，方便人手跟進
DO $$
DECLARE
  rx_remaining integer;
  drug_remaining integer;
BEGIN
  SELECT count(*) INTO rx_remaining
  FROM medication_prescriptions WHERE administration_route = '注射';
  SELECT count(*) INTO drug_remaining
  FROM medication_drug_database WHERE administration_route = '注射';
  RAISE NOTICE '仍保留為「注射」待人手分類：處方 % 筆、藥物主檔 % 筆', rx_remaining, drug_remaining;
END $$;

COMMIT;
