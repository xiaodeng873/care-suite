import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const anon = get('VITE_SUPABASE_ANON_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const j = (r) => r.json().catch(() => null);
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra ?? ''); } };

const UNAME = 'rb_test_' + Date.now();
async function mkUser(fid) {
  const ins = await j(await fetch(B + '/rest/v1/user_profiles', { method: 'POST', headers: H, body: JSON.stringify({
    username: UNAME + '_f' + fid, password_hash: 'x', name_zh: '回收筒測試', department: '護理', hire_date: '2026-01-01',
    employment_type: '正職', role: 'admin', is_active: true, nursing_position: '註冊護士', facility_id: fid,
    login_qr_code_id: crypto.randomUUID(),
  }) }));
  const uid = ins[0].id;
  const token = 'rb-' + fid + '-' + Date.now();
  await fetch(B + '/rest/v1/user_sessions', { method: 'POST', headers: H, body: JSON.stringify({
    user_id: uid, token, expires_at: new Date(Date.now() + 3600e3).toISOString(),
  }) });
  return { uid, token };
}
async function dbToken(sessionTok) {
  const r = await j(await fetch(B + '/functions/v1/auth-custom/db-token', {
    method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + sessionTok, 'Content-Type': 'application/json' }, body: '{}',
  }));
  if (!r.success) throw new Error('db-token failed: ' + JSON.stringify(r));
  return r.dbToken;
}
const rpc = (dt, fn, body) => fetch(B + '/rest/v1/rpc/' + fn, {
  method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + dt, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
});
const rest = async (dt, path) => j(await fetch(B + '/rest/v1/' + path, { headers: { apikey: anon, Authorization: 'Bearer ' + dt } }));

try {
  const u1 = await mkUser(1), u2 = await mkUser(2);
  const dt1 = await dbToken(u1.token), dt2 = await dbToken(u2.token);

  // 0. pk column lookup
  const pk1 = await rest(dt1, 'rpc/recycle_pk_column?p_table=eq.meal_guidance');
  const pk2 = await rest(dt1, 'rpc/recycle_pk_column?p_table=eq.' + encodeURIComponent('覆診安排主表'));
  check('pk meal_guidance = id', pk1?.[0]?.recycle_pk_column === 'id', JSON.stringify(pk1));
  check('pk 覆診安排主表 = 覆診id', pk2?.[0]?.recycle_pk_column === '覆診id', JSON.stringify(pk2));

  // pick a real facility-1 meal_guidance row
  const rows = await j(await fetch(B + '/rest/v1/meal_guidance?facility_id=eq.1&select=id&limit=1', { headers: H }));
  check('found fac1 meal_guidance row', rows.length === 1, JSON.stringify(rows));
  const targetId = rows[0].id;
  const original = await j(await fetch(B + '/rest/v1/meal_guidance?id=eq.' + targetId, { headers: H }));

  // 1. whitelist rejection
  const rBad = await rpc(dt1, 'recycle_soft_delete', { p_table: '院友主表', p_id: '1' });
  check('whitelist rejects 院友主表', rBad.status !== 200, 'status=' + rBad.status);

  // 2. soft delete
  const rDel = await rpc(dt1, 'recycle_soft_delete', { p_table: 'meal_guidance', p_id: targetId, p_reason: '回收筒測試' });
  check('soft delete ok', rDel.status === 200, 'status=' + rDel.status + ' ' + JSON.stringify(await j(rDel)));
  const gone = await j(await fetch(B + '/rest/v1/meal_guidance?id=eq.' + targetId, { headers: H }));
  check('row removed from meal_guidance', gone.length === 0);
  const bin = await j(await fetch(B + '/rest/v1/deleted_records?original_table=eq.meal_guidance&original_id=eq.' + targetId + '&select=id,facility_id,deletion_reason,data', { headers: H }));
  check('row in deleted_records', bin.length === 1 && bin[0].facility_id === 1, JSON.stringify(bin));
  const binId = bin[0]?.id;

  // 3. fac2 cannot see/restore/permanent-delete fac1 bin row
  const vis2 = await rest(dt2, 'deleted_records?original_table=eq.meal_guidance&original_id=eq.' + targetId + '&select=id');
  check('fac2 cannot see fac1 bin row', vis2.length === 0, JSON.stringify(vis2));
  const rX = await rpc(dt2, 'recycle_restore', { p_recycle_id: binId });
  check('fac2 restore rejected', rX.status !== 200, 'status=' + rX.status);
  const rXp = await rpc(dt2, 'recycle_permanent_delete', { p_recycle_id: binId });
  check('fac2 permanent delete rejected', rXp.status !== 200, 'status=' + rXp.status);

  // 4. fac1 restore
  const rRes = await rpc(dt1, 'recycle_restore', { p_recycle_id: binId });
  check('restore ok', rRes.status === 200, 'status=' + rRes.status + ' ' + JSON.stringify(await j(rRes)));
  const back = await j(await fetch(B + '/rest/v1/meal_guidance?id=eq.' + targetId, { headers: H }));
  check('row back in meal_guidance', back.length === 1, 'count=' + back.length);

  // 5. permanent delete path（之後用保留嘅原文重新插返，確保真實資料還原）
  await rpc(dt1, 'recycle_soft_delete', { p_table: 'meal_guidance', p_id: targetId, p_reason: '回收筒測試2' });
  const bin2 = await j(await fetch(B + '/rest/v1/deleted_records?original_table=eq.meal_guidance&original_id=eq.' + targetId + '&select=id', { headers: H }));
  const rPd = await rpc(dt1, 'recycle_permanent_delete', { p_recycle_id: bin2[0].id });
  check('permanent delete ok', rPd.status === 200, 'status=' + rPd.status);
  const bin3 = await j(await fetch(B + '/rest/v1/deleted_records?original_table=eq.meal_guidance&original_id=eq.' + targetId, { headers: H }));
  check('bin entry gone after permanent delete', bin3.length === 0);
  const stillGone = await j(await fetch(B + '/rest/v1/meal_guidance?id=eq.' + targetId, { headers: H }));
  check('original stays deleted after permanent delete', stillGone.length === 0);

  // 還原真實資料
  const reIns = await j(await fetch(B + '/rest/v1/meal_guidance', { method: 'POST', headers: H, body: JSON.stringify(original[0]) }));
  check('real data re-inserted', Array.isArray(reIns) && reIns.length === 1, JSON.stringify(reIns)?.slice(0, 200));

  console.log('\npass=' + pass + ' fail=' + fail);

  for (const u of [u1, u2]) {
    await fetch(B + '/rest/v1/user_sessions?token=eq.' + u.token, { method: 'DELETE', headers: H });
    await fetch(B + '/rest/v1/user_profiles?id=eq.' + u.uid, { method: 'DELETE', headers: H });
  }
  console.log('test users cleaned');
} catch (e) {
  console.error('SCRIPT ERROR:', e.message);
  process.exitCode = 1;
}
