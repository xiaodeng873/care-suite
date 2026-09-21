// 用 Supabase Management API 查周恩求嘅 active 口服處方（service key 已停用）
process.loadEnvFile('.env');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = 'mzeptzwuqvpjspxgnzkp';
const sql = `
select p."院友id", p."中文姓名", p."床號"
from "院友主表" p where p."中文姓名" like '%周恩求%';
`;
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql })
});
const rows = await res.json();
console.log(JSON.stringify(rows));
if (!Array.isArray(rows) || !rows.length) process.exit(0);
const pid = rows[0].院友id;
const res2 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `
select medication_name, administration_route, dosage_amount, dosage_unit, frequency_type, frequency_value, is_prn, is_odd_even_day, medication_time_slots, start_date, end_date, status
from new_medication_prescriptions where patient_id = ${pid} and status = 'active' order by medication_name;` })
});
const rxs = await res2.json();
for (const r of Array.isArray(rxs) ? rxs : []) console.log(JSON.stringify(r));
if (!Array.isArray(rxs)) console.log(JSON.stringify(rxs));
