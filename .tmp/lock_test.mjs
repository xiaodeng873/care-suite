import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=["\']?([^"\'\r\n]+)', 'm')); return m ? m[1].trim() : null; };
const svc = get('SUPABASE_SERVICE_ROLE_KEY');
const anon = get('VITE_SUPABASE_ANON_KEY');
const B = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', Prefer: 'return=representation' };

const existing = await (await fetch(B + '/rest/v1/user_profiles?username=eq.wf_fac1', { headers: H })).json();
const token = 'lock-' + Date.now();
await fetch(B + '/rest/v1/user_sessions', { method: 'POST', headers: H, body: JSON.stringify({
  user_id: existing[0].id, token, expires_at: new Date(Date.now() + 3600e3).toISOString(),
}) });
const dt = (await (await fetch(B + '/functions/v1/auth-custom/db-token', {
  method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}',
})).json()).dbToken;

const probes = [
  ['get_monthly_death_count', { target_month: '2026-09-01' }],
  ['get_daily_discharge_count', { target_date: '2026-09-04' }],
  ['get_pressure_ulcer_count', {}],
  ['archive_patient_health_assessments', { p_patient_id: 1 }],
  ['check_medication_workflow_duplicates', {}],
  ['fix_bed_occupied_status', {}],
];
for (const [fn, body] of probes) {
  const r = await fetch(B + '/rest/v1/rpc/' + fn, {
    method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + dt, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const t = await r.text();
  console.log(fn, '→ HTTP', r.status, t.slice(0, 120));
}
// view
const v = await fetch(B + '/rest/v1/ai_assistant_daily_stats?select=*&limit=1', { headers: { apikey: anon, Authorization: 'Bearer ' + dt } });
console.log('ai_assistant_daily_stats → HTTP', v.status, (await v.text()).slice(0, 120));
