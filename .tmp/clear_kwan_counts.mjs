import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('diaper_change_records')
  .update({ urine_count: null, core_count: null })
  .eq('patient_id', 537)
  .gte('change_date', '2026-07-01')
  .lte('change_date', '2026-07-31')
  .select('id');
if (error) { console.error('❌', error); process.exit(1); }
console.log(`✅ 關春杏 2026-07 已清空 ${data.length} 筆記錄的尿片/片芯數`);
