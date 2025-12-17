/*
  # 修復安全問題 Part 2 - RLS 策略優化

  1. 優化 RLS 策略性能
    - 修復 user_ocr_prompts 表的策略
    - 修復 ocr_recognition_logs 表的策略
    - 使用 (select auth.uid()) 代替 auth.uid()
  
  2. 移除重複的 RLS 策略
    - 清理多個表的重複策略
*/

-- ==========================================
-- 1. 優化 user_ocr_prompts 的 RLS 策略
-- ==========================================

-- 刪除舊策略
DROP POLICY IF EXISTS "Users can view own prompts" ON public.user_ocr_prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON public.user_ocr_prompts;
DROP POLICY IF EXISTS "Users can update own prompts" ON public.user_ocr_prompts;
DROP POLICY IF EXISTS "Users can delete own prompts" ON public.user_ocr_prompts;

-- 創建優化的新策略
CREATE POLICY "Users can view own prompts"
  ON public.user_ocr_prompts
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own prompts"
  ON public.user_ocr_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own prompts"
  ON public.user_ocr_prompts
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own prompts"
  ON public.user_ocr_prompts
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ==========================================
-- 2. 優化 ocr_recognition_logs 的 RLS 策略
-- ==========================================

-- 刪除舊策略
DROP POLICY IF EXISTS "Users can view own logs" ON public.ocr_recognition_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.ocr_recognition_logs;

-- 創建優化的新策略
CREATE POLICY "Users can view own logs"
  ON public.ocr_recognition_logs
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own logs"
  ON public.ocr_recognition_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ==========================================
-- 3. 清理重複的 RLS 策略 - beds 表
-- ==========================================

DROP POLICY IF EXISTS "Allow authenticated users to manage beds" ON public.beds;
-- 保留 "Allow authenticated users to read beds"

-- ==========================================
-- 4. 清理重複的 RLS 策略 - patient_restraint_assessments 表
-- ==========================================

DROP POLICY IF EXISTS "Allow authenticated users to read patient restraint assessments" ON public.patient_restraint_assessments;
DROP POLICY IF EXISTS "Allow authenticated users to insert patient restraint assessmen" ON public.patient_restraint_assessments;
DROP POLICY IF EXISTS "Allow authenticated users to update patient restraint assessmen" ON public.patient_restraint_assessments;
DROP POLICY IF EXISTS "Allow authenticated users to delete patient restraint assessmen" ON public.patient_restraint_assessments;
-- 保留 restraint assessments 的策略

-- ==========================================
-- 5. 清理重複的 RLS 策略 - stations 表
-- ==========================================

DROP POLICY IF EXISTS "Allow authenticated users to manage stations" ON public.stations;
-- 保留 "Allow authenticated users to read stations"

-- ==========================================
-- 6. 清理重複的 RLS 策略 - 健康記錄主表
-- ==========================================

DROP POLICY IF EXISTS "允許已認證用戶修改健康記錄" ON public.健康記錄主表;
DROP POLICY IF EXISTS "允許已認證用戶讀取健康記錄" ON public.健康記錄主表;
-- 保留 "只允許本人" 系列的策略

-- ==========================================
-- 7. 清理重複的 RLS 策略 - 到診排程主表
-- ==========================================

DROP POLICY IF EXISTS "允許已認證用戶修改排程資料" ON public.到診排程主表;
-- 保留 "允許已認證用戶讀取排程資料"

-- ==========================================
-- 8. 清理重複的 RLS 策略 - 到診院友_看診原因
-- ==========================================

DROP POLICY IF EXISTS "允許已認證用戶修改看診原因關聯" ON public.到診院友_看診原因;
-- 保留 "允許已認證用戶讀取看診原因關聯"

-- ==========================================
-- 9. 清理重複的 RLS 策略 - 看診原因選項
-- ==========================================

DROP POLICY IF EXISTS "允許已認證用戶修改看診原因" ON public.看診原因選項;
-- 保留 "允許已認證用戶讀取看診原因"

-- ==========================================
-- 10. 清理重複的 RLS 策略 - 看診院友細項
-- ==========================================

DROP POLICY IF EXISTS "允許已認證用戶修改看診院友細項" ON public.看診院友細項;
-- 保留 "允許已認證用戶讀取看診院友細項"

-- ==========================================
-- 11. 清理重複的 RLS 策略 - 院友主表
-- ==========================================

DROP POLICY IF EXISTS "允許已認證用戶修改院友資料" ON public.院友主表;
-- 保留 "允許已認證用戶讀取院友資料"