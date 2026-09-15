import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: facilities } = await supabase.from('facilities').select('id, name, code');
console.log('facilities:', JSON.stringify(facilities));

const { data: profiles, count } = await supabase
  .from('user_profiles')
  .select('id, username, name_zh, role, facility_id, is_active, auth_user_id, created_at', { count: 'exact' });
console.log('user_profiles count:', count);
const byFac = {};
profiles?.forEach(p => { byFac[p.facility_id] = (byFac[p.facility_id] || 0) + 1; });
console.log('by facility_id:', JSON.stringify(byFac));
profiles?.slice(0, 20).forEach(p =>
  console.log(`- id=${p.id} username=${p.username} name=${p.name_zh} role=${p.role} facility_id=${p.facility_id} active=${p.is_active} auth_user_id=${p.auth_user_id ? 'yes' : 'NO'}`));

const { data: authUsers } = await supabase.auth.admin.listUsers();
console.log('\nauth users:', authUsers?.users?.length);
authUsers?.users?.forEach(u => console.log(`- ${u.email} role_claim=${u.app_metadata?.user_role} fac=${u.app_metadata?.facility_id ?? u.user_metadata?.facility_id ?? '-'}`));
