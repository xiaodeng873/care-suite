import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sql = readFileSync('supabase/migrations/20260826000000_add_roster_management_permissions.sql', 'utf8');

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

// 驗證：用 service role 查權限列
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase
  .from('permissions')
  .select('category, feature, action')
  .eq('feature', 'roster_management');
if (error) {
  console.log(`❌ 驗證失敗: ${error.message}`);
} else {
  console.log(`✅ roster_management 權限共 ${data.length} 列:`, data.map(d => d.action).join(', '));
}
