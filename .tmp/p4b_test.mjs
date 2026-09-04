import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const anon = get('VITE_SUPABASE_ANON_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', Prefer: 'return=representation' };

// developer profile（facility 2）
const ins = await (await fetch(B + '/rest/v1/user_profiles', { method: 'POST', headers: H, body: JSON.stringify({
  username: 'p4bdev2', password_hash: 'x', name_zh: '開發者測試', department: '行政', hire_date: '2026-01-01',
  employment_type: '正職', role: 'developer', is_active: true, facility_id: 2, login_qr_code_id: crypto.randomUUID(),
}) })).json();
const uid = ins[0].id;
const tok = 'p4bdev2-' + Date.now();
await fetch(B + '/rest/v1/user_sessions', { method: 'POST', headers: H, body: JSON.stringify({ user_id: uid, token: tok, expires_at: new Date(Date.now() + 3600e3).toISOString() }) });

const dt = (await (await fetch(B + '/functions/v1/auth-custom/db-token', {
  method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
  body: JSON.stringify({ facility_id: 2 }),
})).json()).dbToken;
console.log('scoped developer dbToken 取得:', !!dt);

async function count(label, token, table) {
  const r = await fetch(B + '/rest/v1/' + encodeURIComponent(table) + '?select=id', { headers: { apikey: anon, Authorization: 'Bearer ' + token } });
  const t = await r.text();
  const m = t.match(/\/(\d+)(?:,|$)/);
  console.log(label.padEnd(30), 'count=' + (m ? m[1] : t.slice(0, 60)));
}
console.log('--- developer scoped to facility 2（應全 0）---');
await count('院友主表', dt, '院友主表');
await count('medication_drug_database', dt, 'medication_drug_database');
await count('user_profiles', dt, 'user_profiles');

// 清理
await fetch(B + '/rest/v1/user_sessions?user_id=eq.' + uid, { method: 'DELETE', headers: H });
await fetch(B + '/rest/v1/user_profiles?id=eq.' + uid, { method: 'DELETE', headers: H });
console.log('cleanup done');
