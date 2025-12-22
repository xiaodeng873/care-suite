-- Create intake_output_records table for hourly intake and output tracking
CREATE TABLE intake_output_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id INTEGER NOT NULL,
  record_date DATE NOT NULL,
  hour_slot INTEGER NOT NULL CHECK (hour_slot >= 0 AND hour_slot <= 23),
  
  -- 攝入 (Intake) - 使用JSONB存储动态数据
  -- 餐食 (Meals) - [{meal_type: '早餐'|'午餐'|'下午茶'|'晚餐', amount: '1'|'1/4'|'1/2'|'3/4'}]
  meals JSONB DEFAULT '[]'::jsonb,
  
  -- 飲料 (Beverages) - [{type: '清水'|'湯'|'奶'|'果汁'|'糖水'|'茶', amount: number}]
  beverages JSONB DEFAULT '[]'::jsonb,
  
  -- 鼻胃飼 (Tube Feeding) - [{type: 'Isocal'|'Glucerna'|'Compleat', amount: number}]
  tube_feeding JSONB DEFAULT '[]'::jsonb,
  
  -- 排出 (Output)
  -- 尿液 (Urine) - [{volume: number, color: string}]
  urine_output JSONB DEFAULT '[]'::jsonb,
  
  -- 胃液 (Gastric) - [{volume: number, ph: number, color: string}]
  gastric_output JSONB DEFAULT '[]'::jsonb,
  
  -- 記錄者 (必填)
  recorder TEXT NOT NULL,
  
  -- 備註 (狀態: 入院/渡假/外出)
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one record per patient per date per hour
  UNIQUE(patient_id, record_date, hour_slot)
);

-- Create indexes for better query performance
CREATE INDEX idx_intake_output_patient_date ON intake_output_records(patient_id, record_date);
CREATE INDEX idx_intake_output_date ON intake_output_records(record_date);

-- Enable RLS
ALTER TABLE intake_output_records ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all authenticated users for now)
CREATE POLICY "Enable all for authenticated users" ON intake_output_records
  FOR ALL USING (auth.role() = 'authenticated');

-- Create trigger to update updated_at
CREATE TRIGGER update_intake_output_records_updated_at
  BEFORE UPDATE ON intake_output_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE intake_output_records IS '出入量記錄 - 每小時記錄患者的攝入和排出量';
