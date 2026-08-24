import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL || 'https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

// 1. 藥物資料庫 直腸 筆數
const { data: drugs, error: e1 } = await supabase
  .from('medication_drug_database')
  .select('id, drug_name, administration_route')
  .eq('administration_route', '直腸');
if (e1) { console.error('drug db error:', e1); } else {
  console.log('藥物資料庫 直腸 筆數:', drugs.length, drugs.map(d => d.drug_name));
}

// 2. 處方 直腸 筆數
const { count: c2, error: e2 } = await supabase
  .from('new_medication_prescriptions')
  .select('id', { count: 'exact', head: true })
  .eq('administration_route', '直腸');
console.log('處方 直腸 筆數:', e2 ? e2 : c2);

// 3. 處方來源 TWGH 筆數
const { count: c3, error: e3 } = await supabase
  .from('new_medication_prescriptions')
  .select('id', { count: 'exact', head: true })
  .eq('medication_source', 'Tung Wah Group of Hospitals Wong Tai Sin Hospital');
console.log('處方來源 TWGH Wong Tai Sin 筆數:', e3 ? e3 : c3);

// 4. medication_settings 服用途徑
const { data: fs, error: e4 } = await supabase
  .from('facility_settings')
  .select('medication_settings')
  .eq('id', 1)
  .single();
if (e4) console.error(e4);
else console.log('服用途徑:', JSON.stringify(fs.medication_settings.服用途徑));
