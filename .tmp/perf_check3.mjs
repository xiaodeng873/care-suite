import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const j = (r) => r.json().catch(() => null);
const q = async (query_text) => j(await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: H, body: JSON.stringify({ query_text }) }));

console.log('settings:', JSON.stringify(await q("select name, setting from pg_settings where name in ('statement_timeout','work_mem','effective_cache_size')")));
console.log('db size:', JSON.stringify(await q("select pg_size_pretty(pg_database_size(current_database())) as db, pg_size_pretty(pg_total_relation_size('medication_workflow_records')) as wf")));
console.log('counts:', JSON.stringify(await q("select (select count(*) from medication_workflow_records) as wf, (select count(*) from new_medication_prescriptions) as rx, (select count(*) from 院友主表) as pts")));
console.log('indexes:', JSON.stringify(await q("select indexname from pg_indexes where tablename='medication_workflow_records'")));
const t0 = Date.now();
console.log('plan:', JSON.stringify(await q("explain select r.patient_id from medication_workflow_records r where r.scheduled_date <= current_date and (r.preparation_status='pending' or r.verification_status='pending' or r.dispensing_status='pending') group by r.patient_id")));
console.log('explain ms:', Date.now()-t0);
