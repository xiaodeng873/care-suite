import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const anon = get('VITE_SUPABASE_ANON_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const j = (r) => r.json().catch(() => null);

// 1. 建 facility 2（如不存在）
let fac2 = await (await fetch(B + '/rest/v1/facilities?name=eq.%E6%B8%AC%E8%A9%A6%E9%99%A2%E8%88%8DB', { headers: H })).json();
let fid2;
if (fac2.length > 0) { fid2 = fac2[0].id; console.log('facility 已存在 id=', fid2); }
else {
  const ins = await (await fetch(B + '/rest/v1/facilities', { method: 'POST', headers: H, body: JSON.stringify({ name: '測試院舍B' }) })).json();
  fid2 = ins[0].id;
  console.log('facility 2 建立 id=', fid2);
  await fetch(B + '/rest/v1/facility_settings', { method: 'POST', headers: H, body: JSON.stringify({ facility_id: fid2, facility_name_zh: '測試院舍B', facility_phone: '', facility_address_zh: '', facility_fax: '', auto_roster_principles: {} }) });
}

// 2. 建測試用戶 + session（facility 2 和 facility 1 各一）
async function mkUser(fid, uname) {
  const existing = await (await fetch(B + '/rest/v1/user_profiles?username=eq.' + uname, { headers: H })).json();
  let uid;
  if (existing.length > 0) uid = existing[0].id;
  else {
    const ins = await (await fetch(B + '/rest/v1/user_profiles', { method: 'POST', headers: H, body: JSON.stringify({
      username: uname, password_hash: 'x', name_zh: '洩漏測試', department: '護理', hire_date: '2026-01-01',
      employment_type: '正職', role: 'admin', is_active: true, nursing_position: '註冊護士', facility_id: fid,
      login_qr_code_id: crypto.randomUUID(),
    }) })).json();
    uid = ins[0].id;
  }
  const token = 'p4test-' + uname + '-' + Date.now();
  await fetch(B + '/rest/v1/user_sessions', { method: 'POST', headers: H, body: JSON.stringify({
    user_id: uid, token, expires_at: new Date(Date.now() + 3600e3).toISOString(),
  }) });
  return token;
}
const tok2 = await mkUser(fid2, 'p4_fac2');
const tok1 = await mkUser(1, 'p4_fac1');

// 3. 用 session token 經 auth-custom 換 dbToken
async function dbToken(sessionTok) {
  const r = await (await fetch(B + '/functions/v1/auth-custom/db-token', {
    method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + sessionTok, 'Content-Type': 'application/json' }, body: '{}',
  })).json();
  if (!r.success) throw new Error('db-token failed: ' + JSON.stringify(r));
  return r.dbToken;
}
const dt2 = await dbToken(tok2);
const dt1 = await dbToken(tok1);

// 4. 洩漏測試
async function probe(label, dbToken, path) {
  const r = await fetch(B + '/rest/v1/' + path, { headers: { apikey: anon, Authorization: 'Bearer ' + dbToken } });
  const text = (await r.text()).slice(0, 120);
  const m = text.match(/\/(\d+)(?:,|$)/) || text.match(/"\/(\d+)"/);
  console.log(label.padEnd(34), 'status=' + r.status, 'count=' + (m ? m[1] : '?'), text.slice(0, 60).replace(/\n/g, ' '));
}
console.log('\n--- facility 2 token 應只看到 facility 2（全部應為 0 行）---');
await probe('院友主表', dt2, encodeURIComponent('院友主表') + '?select=院友id');
await probe('user_profiles', dt2, 'user_profiles?select=id');
await probe('medication_drug_database', dt2, 'medication_drug_database?select=id');
await probe('problem_library', dt2, 'problem_library?select=id');
await probe('fee_items', dt2, 'fee_items?select=id');
await probe('templates_metadata', dt2, 'templates_metadata?select=id');
await probe('facilities(只應見自己)', dt2, 'facilities?select=id');
console.log('\n--- facility 2 token 走 AI 的 exec_sql_readonly（應被 RLS 攔截=0）---');
const rpc = await (await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + dt2, 'Content-Type': 'application/json' }, body: JSON.stringify({ query_text: 'SELECT count(*) AS n FROM ' + '"院友主表"' }) })).json();
console.log('SQL count(院友主表) =', JSON.stringify(rpc));
console.log('\n--- facility 1 token 陽性對照（應有資料）---');
await probe('院友主表', dt1, encodeURIComponent('院友主表') + '?select=院友id');
await probe('medication_drug_database', dt1, 'medication_drug_database?select=id');
await probe('problem_library', dt1, 'problem_library?select=id');
const rpc1 = await (await fetch(B + '/rest/v1/rpc/exec_sql_readonly', { method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + dt1, 'Content-Type': 'application/json' }, body: JSON.stringify({ query_text: 'SELECT count(*) AS n FROM ' + '"院友主表"' }) })).json();
console.log('SQL count(院友主表) =', JSON.stringify(rpc1));

// 5. 清理測試用戶和 session
for (const uname of ['p4_fac1', 'p4_fac2']) {
  const u = await (await fetch(B + '/rest/v1/user_profiles?username=eq.' + uname + '&select=id', { headers: H })).json();
  if (u.length) {
    await fetch(B + '/rest/v1/user_sessions?user_id=eq.' + u[0].id, { method: 'DELETE', headers: H });
    await fetch(B + '/rest/v1/user_profiles?id=eq.' + u[0].id, { method: 'DELETE', headers: H });
  }
}
console.log('\ncleanup done; facility ' + fid2 + ' 保留（空院舍）');
