/*
  # 建立每日系統任務追蹤表

  1. 新增表格
    - `daily_system_tasks`
      - `id` (uuid, 主鍵)
      - `task_name` (text, 任務名稱)
      - `task_date` (date, 任務日期)
      - `completed_at` (timestamp, 完成時間)
      - `status` (text, 狀態)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 安全性
    - 啟用 RLS
    - 新增已認證用戶的存取策略

  3. 約束條件
    - task_name 和 task_date 的唯一約束
*/

-- 建立每日系統任務表
CREATE TABLE IF NOT EXISTS daily_system_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text NOT NULL,
  task_date date NOT NULL,
  completed_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(task_name, task_date)
);

-- 啟用 RLS
ALTER TABLE daily_system_tasks ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 策略
CREATE POLICY "允許已認證用戶讀取每日系統任務"
  ON daily_system_tasks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增每日系統任務"
  ON daily_system_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新每日系統任務"
  ON daily_system_tasks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_daily_system_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_system_tasks_updated_at
  BEFORE UPDATE ON daily_system_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_system_tasks_updated_at();

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_daily_system_tasks_task_name ON daily_system_tasks(task_name);
CREATE INDEX IF NOT EXISTS idx_daily_system_tasks_task_date ON daily_system_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_daily_system_tasks_status ON daily_system_tasks(status);