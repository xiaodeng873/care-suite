import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

// POST form
const r1 = await fetch(B + '/rest/v1/rpc/recycle_pk_column', { method: 'POST', headers: H, body: JSON.stringify({ p_table: 'meal_guidance' }) });
console.log('POST:', r1.status, JSON.stringify(await j(r1)));

// GET form
const r2 = await fetch(B + '/rest/v1/rpc/recycle_pk_column?p_table=eq.meal_guidance', { headers: H });
console.log('GET:', r2.status, JSON.stringify(await j(r2)));

// check pg_proc directly via a harmless existing rpc? no — check if function exists via service key on a view... just report
