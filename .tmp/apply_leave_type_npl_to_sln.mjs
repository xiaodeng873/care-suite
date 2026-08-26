import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sql = readFileSync('supabase/migrations/20260827000000_leave_type_npl_to_sln.sql', 'utf8');

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

// 驗證：leave_type 可接受 'SLN'，且不再有 'NPL'
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from('user_leave_records').select('leave_type').eq('leave_type', 'SLN').limit(1);
console.log(error ? `❌ 驗證失敗: ${error.message}` : `✅ user_leave_records.leave_type='SLN' 可查詢（${data?.length ?? 0} 筆）`);
