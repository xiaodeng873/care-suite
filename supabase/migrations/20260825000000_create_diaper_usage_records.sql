-- 尿片記錄：院友每月尿片/片芯用量估算與虛擬生成數據
CREATE TABLE IF NOT EXISTS diaper_usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  monthly_diaper_estimate integer,
  monthly_core_estimate integer,
  daily_min_diaper integer DEFAULT 0,
  daily_max_diaper integer,
  daily_min_core integer DEFAULT 0,
  daily_max_core integer,
  generated_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (patient_id, year, month)
);

-- 啟用 RLS
ALTER TABLE diaper_usage_records ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略（冪等）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'diaper_usage_records'
    AND policyname = 'Allow authenticated users to read diaper usage records'
  ) THEN
    CREATE POLICY "Allow authenticated users to read diaper usage records" ON diaper_usage_records
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'diaper_usage_records'
    AND policyname = 'Allow authenticated users to insert diaper usage records'
  ) THEN
    CREATE POLICY "Allow authenticated users to insert diaper usage records" ON diaper_usage_records
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'diaper_usage_records'
    AND policyname = 'Allow authenticated users to update diaper usage records'
  ) THEN
    CREATE POLICY "Allow authenticated users to update diaper usage records" ON diaper_usage_records
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'diaper_usage_records'
    AND policyname = 'Allow authenticated users to delete diaper usage records'
  ) THEN
    CREATE POLICY "Allow authenticated users to delete diaper usage records" ON diaper_usage_records
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
