import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sql = readFileSync('supabase/migrations/20260826000003_shift_setting_min_staff.sql', 'utf8');

const res = await fetch('https://api.supabase.com/v1/projects/mzeptzwuqvpjspxgnzkp/database/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  console.error('❌', res.status, await res.text());
  process.exit(1);
}
console.log('✅ migration 已套用');

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await supabase.from('station_shift_settings').select('min_staff').limit(1);
console.log(error ? `❌ 驗證失敗: ${error.message}` : '✅ station_shift_settings.min_staff 可查詢');
