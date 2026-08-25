import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

const { data: recs, error } = await supabase
  .from('diaper_change_records')
  .select('id, change_date, time_slot, notes')
  .eq('patient_id', 538)
  .gte('change_date', '2026-07-01')
  .lte('change_date', '2026-07-31')
  .order('change_date')
  .order('time_slot');
console.log('李玉嬋 2026-07 現有記錄數:', error || recs.length);
if (recs.length) console.log(recs);
