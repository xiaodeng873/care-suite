import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const list = await (await fetch(B + '/auth/v1/admin/users?page=1&per_page=50', { headers: { apikey: svc, Authorization: 'Bearer ' + svc } })).json();
const users = list.users || [];
for (const u of users.filter(u => u.email?.startsWith('devtest+'))) {
  await fetch(B + '/auth/v1/admin/users/' + u.id, { method: 'DELETE', headers: { apikey: svc, Authorization: 'Bearer ' + svc } });
  console.log('deleted', u.email);
}
