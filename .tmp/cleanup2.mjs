import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const txt = async (r) => ({ status: r.status, body: (await r.text()).slice(0, 300) });

// 分開查，避開 or/like 語法問題
for (const uname of ['p4_fac1', 'p4_fac2', 'wf_fac1', 'wf_fac2']) {
  const r = await fetch(B + '/rest/v1/user_profiles?username=eq.' + uname + '&select=id,username,name_zh,facility_id', { headers: H });
  const rows = JSON.parse(await r.text());
  if (!rows.length) { console.log(uname, '→ not found'); continue; }
  const u = rows[0];
  await fetch(B + '/rest/v1/user_sessions?user_id=eq.' + u.id, { method: 'DELETE', headers: H });
  const d = await fetch(B + '/rest/v1/user_profiles?id=eq.' + u.id, { method: 'DELETE', headers: H });
  console.log('deleted', u.username, u.name_zh, 'facility', u.facility_id, '→', d.status);
}
// 複查
const r2 = await fetch(B + '/rest/v1/user_profiles?name_zh=in.(洩漏測試,收緊測試)&select=username,name_zh', { headers: H });
console.log('remaining:', await r2.text());
