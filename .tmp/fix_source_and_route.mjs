import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL || 'https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

// 1. 處方來源 TWGH → 東華三院黃大仙醫院
const { data: r1, error: e1 } = await supabase
  .from('new_medication_prescriptions')
  .update({ medication_source: '東華三院黃大仙醫院' })
  .eq('medication_source', 'Tung Wah Group of Hospitals Wong Tai Sin Hospital')
  .select('id');
console.log('1. 處方來源更新:', e1 ? e1 : `${r1.length} 筆`);

// 2. 處方 直腸 → 肛門
const { data: r2, error: e2 } = await supabase
  .from('new_medication_prescriptions')
  .update({ administration_route: '肛門' })
  .eq('administration_route', '直腸')
  .select('id');
console.log('2. 處方 直腸→肛門:', e2 ? e2 : `${r2.length} 筆`);

// 3. 藥物資料庫 直腸 → 肛門
const { data: r3, error: e3 } = await supabase
  .from('medication_drug_database')
  .update({ administration_route: '肛門' })
  .eq('administration_route', '直腸')
  .select('id');
console.log('3. 藥物資料庫 直腸→肛門:', e3 ? e3 : `${r3.length} 筆`);

// 4. medication_settings 服用途徑 移除「直腸」
const { data: fs, error: e4 } = await supabase
  .from('facility_settings')
  .select('medication_settings')
  .eq('id', 1)
  .single();
if (e4) { console.error('4. 讀取失敗:', e4); process.exit(1); }
const settings = fs.medication_settings;
settings.服用途徑 = settings.服用途徑.filter(r => r !== '直腸');
const { error: e5 } = await supabase
  .from('facility_settings')
  .update({ medication_settings: settings })
  .eq('id', 1);
console.log('4. 服用途徑移除「直腸」:', e5 ? e5 : '完成，現有 ' + JSON.stringify(settings.服用途徑));
