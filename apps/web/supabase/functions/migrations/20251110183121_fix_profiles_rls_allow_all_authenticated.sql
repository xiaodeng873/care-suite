/*
  # 修復 profiles 表的 RLS 策略

  問題：profiles 表的 RLS 策略過於嚴格，只允許用戶訪問自己的 profile
  這導致應用無法載入其他用戶的資訊（例如查看誰創建了某個記錄）

  解決方案：允許所有已認證用戶讀取所有 profiles，但只能修改自己的
*/

-- 刪除過於嚴格的策略
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

-- 創建新的策略：允許所有已認證用戶讀取所有 profiles
CREATE POLICY "Allow authenticated users to read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 只允許用戶插入自己的 profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- 只允許用戶更新自己的 profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- 只允許用戶刪除自己的 profile
CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));