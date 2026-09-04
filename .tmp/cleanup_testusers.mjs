import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const j = (r) => r.json().catch(() => null);

// 搵出所有測試帳戶（我建立嘅，username 有特定前綴或姓名係測試名）
const users = await j(await fetch(B + '/rest/v1/user_profiles?or=(username.like.p4_%,username.like.wf_%)&select=id,username,name_zh,facility_id', { headers: H }));
console.log('found:', JSON.stringify(users));
for (const u of users) {
  // 先刪 sessions
  await fetch(B + '/rest/v1/user_sessions?user_id=eq.' + u.id, { method: 'DELETE', headers: H });
  const r = await fetch(B + '/rest/v1/user_profiles?id=eq.' + u.id, { method: 'DELETE', headers: H });
  console.log('deleted', u.username, u.name_zh, 'facility', u.facility_id, '→', r.status);
}
// 複查：仲有冇測試名殘留
const left = await j(await fetch(B + '/rest/v1/user_profiles?or=(name_zh.eq.洩漏測試,name_zh.eq.收緊測試)&select=username,name_zh', { headers: H }));
console.log('remaining test users:', JSON.stringify(left));
