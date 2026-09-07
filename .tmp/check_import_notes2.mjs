const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: H });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

const tables = [
  'patient_health_records',
  'new_medication_prescriptions',
  'medication_workflow_records',
  'patient_health_tasks',
  'diagnosis_records',
  'patient_annual_health_checkups',
  'patient_evening_care_plans',
  'patient_restraint_assessments',
  'patient_wound_records',
  'patient_tube_care_records',
  'patient_follow_up_appointments',
];

for (const t of tables) {
  const data = await get(`/${t}?select=*&limit=10000`);
  if (!Array.isArray(data)) { console.log(`${t}: 查詢失敗`, JSON.stringify(data).slice(0, 150)); continue; }
  const hits = [];
  const sigValues = {};
  for (const row of data) {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'string' && v.includes('匯入')) hits.push(`${k}=${v.slice(0, 60)}`);
      if (typeof v === 'string' && /簽|staff|人員|醫生|護士|created_by|modified_by|signature/i.test(k) && v) {
        sigValues[`${k}=${v.slice(0, 40)}`] = (sigValues[`${k}=${v.slice(0, 40)}`] || 0) + 1;
      }
    }
  }
  console.log(`\n=== ${t}（${data.length} 筆）===`);
  console.log('含「匯入」:', hits.length, hits.slice(0, 5));
  const sig = Object.entries(sigValues).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('簽署類欄位:', JSON.stringify(sig));
}
