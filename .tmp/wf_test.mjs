import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const anon = get('VITE_SUPABASE_ANON_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const j = (r) => r.json().catch(() => null);

async function mkUser(fid, uname) {
  const existing = await j(await fetch(B + '/rest/v1/user_profiles?username=eq.' + uname, { headers: H }));
  let uid;
  if (existing.length > 0) uid = existing[0].id;
  else {
    const ins = await j(await fetch(B + '/rest/v1/user_profiles', { method: 'POST', headers: H, body: JSON.stringify({
      username: uname, password_hash: 'x', name_zh: '收緊測試', department: '護理', hire_date: '2026-01-01',
      employment_type: '正職', role: 'admin', is_active: true, nursing_position: '註冊護士', facility_id: fid,
      login_qr_code_id: crypto.randomUUID(),
    }) }));
    uid = ins[0].id;
  }
  const token = 'wf-' + uname + '-' + Date.now();
  await fetch(B + '/rest/v1/user_sessions', { method: 'POST', headers: H, body: JSON.stringify({
    user_id: uid, token, expires_at: new Date(Date.now() + 3600e3).toISOString(),
  }) });
  return token;
}
async function dbToken(sessionTok) {
  const r = await j(await fetch(B + '/functions/v1/auth-custom/db-token', {
    method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + sessionTok, 'Content-Type': 'application/json' }, body: '{}',
  }));
  if (!r.success) throw new Error('db-token failed: ' + JSON.stringify(r));
  return r.dbToken;
}

const dt1 = await dbToken(await mkUser(1, 'wf_fac1'));
const dt2 = await dbToken(await mkUser(2, 'wf_fac2'));

// 1. facility 1 dbToken → 應成功，只處理 facility 1 處方
const r1 = await j(await fetch(B + '/functions/v1/generate-daily-medication-workflow?date=2026-09-04', {
  headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'X-Db-Token': dt1 },
}));
console.log('fac1:', JSON.stringify(r1));

// 2. facility 2（空院舍）dbToken → 應 0 筆
const r2 = await j(await fetch(B + '/functions/v1/generate-daily-medication-workflow?date=2026-09-04', {
  headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'X-Db-Token': dt2 },
}));
console.log('fac2:', JSON.stringify(r2));

// 3. 無 token → 401
const r3 = await fetch(B + '/functions/v1/generate-daily-medication-workflow?date=2026-09-04', {
  headers: { apikey: anon, Authorization: 'Bearer ' + anon },
});
console.log('no-token HTTP:', r3.status, await r3.text());

// 4. 假 token → 應失敗（prescriptions 查詢會 auth 錯）
const r4 = await j(await fetch(B + '/functions/v1/generate-daily-medication-workflow?date=2026-09-04', {
  headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'X-Db-Token': 'invalid.token.here' },
}));
console.log('fake-token:', JSON.stringify(r4));
