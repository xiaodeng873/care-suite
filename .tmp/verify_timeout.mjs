import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const j = (r) => r.json().catch(() => null);
console.log('role setting:', JSON.stringify(await j(await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: H, body: JSON.stringify({ query_text: "select rolname, rolconfig from pg_roles where rolname='authenticated'" }) }))));
console.log('index:', JSON.stringify(await j(await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: H, body: JSON.stringify({ query_text: "select indexname from pg_indexes where indexname='idx_wf_pending_overdue'" }) }))));
