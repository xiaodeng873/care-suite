/*
  # 修復安全問題 Part 5 - 啟用 RLS

  1. 為 profiles 表啟用 RLS
  2. 創建 RLS 策略確保用戶只能訪問自己的資料
*/

-- 為 profiles 表啟用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));