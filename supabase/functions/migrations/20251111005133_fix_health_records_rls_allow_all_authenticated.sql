/*
  # 修復健康記錄主表的 RLS 策略
  
  問題：健康記錄主表的 RLS 策略限制只能讀取「本人」的記錄
  這導致醫護人員無法查看和管理所有院友的健康記錄
  
  解決方案：允許所有已認證用戶（醫護人員）管理所有健康記錄
*/

-- 刪除過於嚴格的策略
DROP POLICY IF EXISTS "只允許本人讀取健康記錄" ON public.健康記錄主表;
DROP POLICY IF EXISTS "只允許本人新增健康記錄" ON public.健康記錄主表;
DROP POLICY IF EXISTS "只允許本人更新健康記錄" ON public.健康記錄主表;
DROP POLICY IF EXISTS "只允許本人刪除健康記錄" ON public.健康記錄主表;

-- 創建新的策略：允許所有已認證用戶管理所有健康記錄
CREATE POLICY "允許已認證用戶管理健康記錄"
  ON public.健康記錄主表
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);