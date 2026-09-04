import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const j = (r) => r.json().catch(() => null);

// statement_timeout 設定
const st = await j(await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: H, body: JSON.stringify({ query: "select name, setting from pg_settings where name in ('statement_timeout','idle_in_transaction_session_timeout','work_mem')" }) }));
console.log('settings:', JSON.stringify(st));

// 表大小同記錄數
const cnt = await j(await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: H, body: JSON.stringify({ query: "select (select count(*) from medication_workflow_records) as wf, (select count(*) from new_medication_prescriptions) as rx, pg_size_pretty(pg_total_relation_size('medication_workflow_records')) as wf_size" }) }));
console.log('counts:', JSON.stringify(cnt));

// EXPLAIN ANALYZE 個 RPC 核心查詢
const t0 = Date.now();
const ex = await j(await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: H, body: JSON.stringify({ query: "explain (analyze, format json) select r.patient_id, count(*) from medication_workflow_records r where r.scheduled_date <= current_date and (r.preparation_status='pending' or r.verification_status='pending' or r.dispensing_status='pending') group by r.patient_id" }) }));
console.log('explain ms:', Date.now() - t0);
if (ex?.[0]) {
  const plan = ex[0]['QUERY PLAN']?.[0]?.Plan;
  console.log('plan:', plan?.['Node Type'], 'cost:', plan?.['Total Cost'], 'rows:', plan?.['Plan Rows'], 'actual ms:', plan?.['Actual Total Time']);
}

// 直接跑 RPC 計時（service role）
const t1 = Date.now();
const r = await fetch(B + '/rest/v1/rpc/get_overdue_workflow_counts', { method: 'POST', headers: H, body: '{}' });
const rows = await j(r);
console.log('rpc ms:', Date.now() - t1, 'status', r.status, 'rows:', Array.isArray(rows) ? rows.length : rows);
