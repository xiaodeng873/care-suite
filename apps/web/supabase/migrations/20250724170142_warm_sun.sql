/*
  # Patient Management System Enhancements

  1. New Enum Types
    - `residency_status` - 在住, 已退住
    - `nursing_level_type` - 全護理, 半護理, 自理
    - `admission_type_enum` - 私位, 買位, 院舍卷, 暫住

  2. Table Updates
    - Add new fields to `院友主表`
      - `入住日期` (admission_date) - date, nullable
      - `退住日期` (discharge_date) - date, nullable
      - `護理等級` (nursing_level) - nursing_level_type, nullable
      - `入住類型` (admission_type) - admission_type_enum, nullable
      - `社會福利` (social_welfare) - jsonb, nullable
      - `在住狀態` (residency_status) - residency_status, default '在住'

  3. Security
    - Maintain existing RLS policies
*/

-- Create residency status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'residency_status') THEN
    CREATE TYPE residency_status AS ENUM ('在住', '已退住');
  END IF;
END $$;

-- Create nursing level type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nursing_level_type') THEN
    CREATE TYPE nursing_level_type AS ENUM ('全護理', '半護理', '自理');
  END IF;
END $$;

-- Create admission type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admission_type_enum') THEN
    CREATE TYPE admission_type_enum AS ENUM ('私位', '買位', '院舍卷', '暫住');
  END IF;
END $$;

-- Add new fields to 院友主表
DO $$
BEGIN
  -- Add admission_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '入住日期'
  ) THEN
    ALTER TABLE 院友主表 ADD COLUMN 入住日期 date;
  END IF;

  -- Add discharge_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '退住日期'
  ) THEN
    ALTER TABLE 院友主表 ADD COLUMN 退住日期 date;
  END IF;

  -- Add nursing_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '護理等級'
  ) THEN
    ALTER TABLE 院友主表 ADD COLUMN 護理等級 nursing_level_type;
  END IF;

  -- Add admission_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '入住類型'
  ) THEN
    ALTER TABLE 院友主表 ADD COLUMN 入住類型 admission_type_enum;
  END IF;

  -- Add social_welfare
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '社會福利'
  ) THEN
    ALTER TABLE 院友主表 ADD COLUMN 社會福利 jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add residency_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '在住狀態'
  ) THEN
    ALTER TABLE 院友主表 ADD COLUMN 在住狀態 residency_status DEFAULT '在住';
  END IF;

  -- Add infection_control field if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = '感染控制'
  ) THEN
    ALTER TABLE 院友主表 ADD COLUMN 感染控制 jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_院友主表_在住狀態 ON 院友主表(在住狀態);
CREATE INDEX IF NOT EXISTS idx_院友主表_入住日期 ON 院友主表(入住日期);
CREATE INDEX IF NOT EXISTS idx_院友主表_護理等級 ON 院友主表(護理等級);
CREATE INDEX IF NOT EXISTS idx_院友主表_入住類型 ON 院友主表(入住類型);
CREATE INDEX IF NOT EXISTS idx_院友主表_社會福利 ON 院友主表 USING gin(社會福利);