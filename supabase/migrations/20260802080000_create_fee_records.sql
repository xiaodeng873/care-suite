-- fee_items 收費項目目錄
CREATE TABLE IF NOT EXISTS fee_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_zh text NOT NULL,
  category text NOT NULL CHECK (category IN ('服務','用品')),
  unit text NOT NULL CHECK (unit IN ('次','個','日','月','項','小時','療程')),
  unit_price numeric(10,2) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- patient_fee_records 院友費用明細（扁平 line-item）
CREATE TABLE IF NOT EXISTS patient_fee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  fee_item_id uuid REFERENCES fee_items(id) ON DELETE SET NULL,
  record_date date NOT NULL,
  item_name text NOT NULL,
  item_category text NOT NULL,
  unit text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  amount numeric(10,2) NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_items_category ON fee_items(category);
CREATE INDEX IF NOT EXISTS idx_fee_items_active ON fee_items(is_active);
CREATE INDEX IF NOT EXISTS idx_fee_items_order ON fee_items(display_order);
CREATE INDEX IF NOT EXISTS idx_patient_fee_records_patient_id ON patient_fee_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_fee_records_record_date ON patient_fee_records(record_date);
CREATE INDEX IF NOT EXISTS idx_patient_fee_records_fee_item_id ON patient_fee_records(fee_item_id);

-- updated_at 觸發器
CREATE OR REPLACE FUNCTION update_fee_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fee_items_updated_at ON fee_items;
CREATE TRIGGER trg_fee_items_updated_at
  BEFORE UPDATE ON fee_items
  FOR EACH ROW EXECUTE FUNCTION update_fee_items_updated_at();

DROP TRIGGER IF EXISTS trg_patient_fee_records_updated_at ON patient_fee_records;
CREATE TRIGGER trg_patient_fee_records_updated_at
  BEFORE UPDATE ON patient_fee_records
  FOR EACH ROW EXECUTE FUNCTION update_fee_items_updated_at();

-- RLS
ALTER TABLE fee_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_fee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access fee_items"
  ON fee_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access patient_fee_records"
  ON patient_fee_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 權限 seed
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  ('records', 'fee_records', '費用記錄', 'view', '/fee-records'),
  ('records', 'fee_records', '費用記錄', 'create', '/fee-records'),
  ('records', 'fee_records', '費用記錄', 'edit', '/fee-records'),
  ('records', 'fee_records', '費用記錄', 'delete', '/fee-records')
ON CONFLICT (category, feature, action) DO NOTHING;
