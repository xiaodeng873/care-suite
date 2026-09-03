-- 為 patient_evening_care_plans 補上與全專案一致的 "Allow all access" policy
-- （專案 59 張表均使用 FOR ALL TO anon, authenticated；apps/web 以 anon key 直接存取，
--   只有 authenticated policy 會令匿名請求觸發 42501）
DROP POLICY IF EXISTS "Allow all access" ON patient_evening_care_plans;

CREATE POLICY "Allow all access" ON patient_evening_care_plans
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
