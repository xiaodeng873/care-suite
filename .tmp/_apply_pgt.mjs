import { readFileSync } from 'fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0];
const sql = readFileSync('supabase/migrations/20260921000000_create_pgt_records.sql', 'utf8');

const run = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => null);
  console.log(res.status, JSON.stringify(body));
  return res;
};

await run(sql);
console.log('--- verify ---');
await run("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='pgt_records'");
await run("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pgt_records' ORDER BY ordinal_position");
