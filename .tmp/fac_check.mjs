import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc };
const j = (r) => r.json().catch(() => null);
console.log('facilities:', JSON.stringify(await j(await fetch(B + '/rest/v1/facilities?select=id,name,is_active', { headers: H }))));
console.log('facility_settings:', JSON.stringify(await j(await fetch(B + '/rest/v1/facility_settings?select=facility_id,facility_name_zh', { headers: H }))));
