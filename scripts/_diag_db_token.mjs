import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = 'tmp_diag_dev@example.com';
const PASSWORD = 'TmpDiag#12345';

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const cleanup = async () => {
  const { data } = await admin.auth.admin.listUsers();
  const u = data?.users?.find(u => u.email === EMAIL);
  if (u) await admin.auth.admin.deleteUser(u.id);
};

try {
  await cleanup();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (cErr) throw cErr;
  console.log('temp auth user created:', created.user.id);

  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signIn, error: sErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (sErr) throw sErr;
  const accessToken = signIn.session.access_token;

  // 1) 無 facility_id（維運模式）
  const r1 = await fetch(url + '/functions/v1/auth-custom/db-token', {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'db-token', facility_id: null }),
  });
  const j1 = await r1.json();
  console.log('db-token (ops mode) status:', r1.status, 'success:', j1?.success, j1?.error || '');

  if (j1?.dbToken) {
    const payload = JSON.parse(Buffer.from(j1.dbToken.split('.')[1], 'base64url').toString());
    console.log('dbToken claims:', JSON.stringify(payload));
    const authed = createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + j1.dbToken } }, auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error, count } = await authed.from('user_profiles').select('*', { count: 'exact' });
    console.log('user_profiles via ops-mode dbToken: count =', count, 'error:', JSON.stringify(error));
  }

  // 2) 鎖定院舍 1
  const r2 = await fetch(url + '/functions/v1/auth-custom/db-token', {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'db-token', facility_id: 1 }),
  });
  const j2 = await r2.json();
  console.log('db-token (facility 1) status:', r2.status, 'success:', j2?.success, j2?.error || '');
  if (j2?.dbToken) {
    const authed = createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + j2.dbToken } }, auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error, count } = await authed.from('user_profiles').select('*', { count: 'exact' });
    console.log('user_profiles via facility-1 dbToken: count =', count, 'error:', JSON.stringify(error));
  }
} finally {
  await cleanup();
  console.log('temp user cleaned up');
}
