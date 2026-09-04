import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc };
const rows = await (await fetch(B + '/rest/v1/patient_evening_care_plans?select=id,patient_id,acp_sign_dates,amd_sign_dates,dnacpr_sign_dates', { headers: H })).json();
console.log(JSON.stringify(rows, null, 1));
