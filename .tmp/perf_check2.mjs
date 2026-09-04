import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const anon = get('VITE_SUPABASE_ANON_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const j = (r) => r.json().catch(() => null);

const st = await j(await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: H, body: JSON.stringify({ p_query: "select name, setting from pg_settings where name in ('statement_timeout','work_mem')" }) }));
console.log('settings:', JSON.stringify(st));
