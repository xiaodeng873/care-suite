import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const anon = get('VITE_SUPABASE_ANON_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const j = (r) => r.json().catch(() => null);

// 建一個無 user_profiles 的 Supabase Auth 用戶（developer 身分）
const email = 'devtest+' + Date.now() + '@example.com';
const au = await j(await fetch(B + '/auth/v1/admin/users', {
  method: 'POST',
  headers: { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'testpass123', email_confirm: true }),
}));
if (!au?.id) { console.error('create auth user failed', au); process.exit(1); }
const signIn = await j(await fetch(B + '/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'testpass123' }),
}));
const authTok = signIn.access_token;
const dt = await j(await fetch(B + '/functions/v1/auth-custom/db-token', {
  method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + authTok, 'Content-Type': 'application/json' }, body: '{}',
}));
if (!dt.success) { console.error('db-token failed', dt); process.exit(1); }
console.log('developer dbToken 取得，facility_id claim =', JSON.parse(Buffer.from(dt.dbToken.split('.')[1], 'base64url').toString()).facility_id);

// 1. developer token 調用 RPC
const r1 = await j(await fetch(B + '/rest/v1/rpc/get_facility_directory', {
  method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + dt.dbToken, 'Content-Type': 'application/json' }, body: '{}',
}));
console.log('developer RPC:', JSON.stringify(r1));

// 2. 普通院舍員工 token 調用 RPC → 應被拒
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const prof = await j(await fetch(B + '/rest/v1/user_profiles?username=eq.wf_fac1', { headers: H }));
const sess = 'dirt-' + Date.now();
await fetch(B + '/rest/v1/user_sessions', { method: 'POST', headers: H, body: JSON.stringify({ user_id: prof[0].id, token: sess, expires_at: new Date(Date.now() + 3600e3).toISOString() }) });
const dt2 = (await j(await fetch(B + '/functions/v1/auth-custom/db-token', {
  method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + sess, 'Content-Type': 'application/json' }, body: '{}',
}))).dbToken;
const r2 = await fetch(B + '/rest/v1/rpc/get_facility_directory', {
  method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + dt2, 'Content-Type': 'application/json' }, body: '{}',
});
console.log('staff RPC → HTTP', r2.status, (await r2.text()).slice(0, 100));
