/*
  # 修復 set_preparation_method_by_dosage_form 觸發器欄位錯誤

  ## 問題
  遷移 20251110175717_fix_security_issues_part4_business_functions_final.sql
  將 `set_preparation_method_by_dosage_form()` 函數重新定義為引用 `NEW.劑型`，
  但 `new_medication_prescriptions` 資料表的實際欄位是 `dosage_form`（英文），
  並不存在 `劑型` 欄位。

  由於該觸發器為 `BEFORE INSERT OR UPDATE`，任何對 `new_medication_prescriptions`
  的新增或更新都會在執行時拋出 `record "new" has no field "劑型"` 錯誤，
  導致「轉移處方」、修改處方等操作全部失敗（前端僅看到一個 PostgrestError Object）。

  此外，原本錯誤的版本還會把 `preparation_method` 設為無效值
  （'original' / 'blister'），而有效值僅為 'immediate' / 'advanced' / 'custom'。

  ## 修復
  以正確的欄位 `dosage_form` 與正確的備藥方式值，還原
  20251004082017_add_special_dosage_and_improvements.sql 的原始邏輯：
  當劑型屬於藥水、注射劑、外用藥膏、滴劑、皮膚貼劑時，
  若備藥方式未設定或為 'advanced'，則預設為 'immediate'（即時備藥）。
*/

CREATE OR REPLACE FUNCTION public.set_preparation_method_by_dosage_form()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 如果劑型為藥水、注射劑、外用藥膏、滴劑、皮膚貼劑，則備藥方式預設為即時備藥
  IF NEW.dosage_form IN ('藥水', '注射劑', '外用藥膏', '滴劑', '皮膚貼劑') THEN
    IF NEW.preparation_method IS NULL OR NEW.preparation_method = 'advanced' THEN
      NEW.preparation_method := 'immediate';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 重新建立觸發器，確保使用修正後的函數
DROP TRIGGER IF EXISTS set_preparation_method_trigger ON new_medication_prescriptions;
DROP TRIGGER IF EXISTS set_preparation_method_trigger ON new_medication_prescriptions;

CREATE TRIGGER set_preparation_method_trigger BEFORE INSERT OR UPDATE ON new_medication_prescriptions
FOR EACH ROW
EXECUTE FUNCTION set_preparation_method_by_dosage_form();
