-- Create table for preset options for incident report
CREATE TABLE IF NOT EXISTS incident_preset_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type TEXT NOT NULL,
  option_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_option_type CHECK (option_type IN ('immediate_improvement_actions', 'prevention_methods')),
  UNIQUE(option_type, option_text)
);

-- Enable RLS
ALTER TABLE incident_preset_options ENABLE ROW LEVEL SECURITY;

-- Allow all users (anon + authenticated) to read
CREATE POLICY "Allow all to read incident_preset_options"
  ON incident_preset_options
  FOR SELECT
  USING (true);

-- Allow all users (anon + authenticated) to insert
CREATE POLICY "Allow all to insert incident_preset_options"
  ON incident_preset_options
  FOR INSERT
  WITH CHECK (true);

-- Allow all users (anon + authenticated) to delete
CREATE POLICY "Allow all to delete incident_preset_options"
  ON incident_preset_options
  FOR DELETE
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_incident_preset_options_type ON incident_preset_options(option_type);

-- Insert default preset options
INSERT INTO incident_preset_options (option_type, option_text, display_order) VALUES
-- 即時改善行動
('immediate_improvement_actions', '即時檢查地面是否濕滑/不平', 1),
('immediate_improvement_actions', '即時檢查光線是否不足', 2),
('immediate_improvement_actions', '即時檢查輪椅/便椅未上鎖', 3),
('immediate_improvement_actions', '即時檢查雜物障礙', 4),
('immediate_improvement_actions', '即時檢查其他院友是否褲腳過長', 5),
('immediate_improvement_actions', '即時檢查鞋履是否合身', 6),
-- 預防意外再次發生的方法
('prevention_methods', '教導院友不要作出不安全的動作', 1),
('prevention_methods', '教導院友使用合適輔助工具', 2),
('prevention_methods', '教導院友需要時要主動尋求協助', 3)
ON CONFLICT DO NOTHING;
