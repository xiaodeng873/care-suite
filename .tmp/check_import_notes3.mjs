const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: H });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

const tables = [
  '健康監測記錄',
  'health_assessments',
  'patient_annual_health_checkups',
  'patient_wound_records',
  'intake_output_records',
  'cgat_records',
  'meal_guidance',
  'patient_logs',
  '覆診安排主表',
  'medication_workflow_records',
  'new_medication_prescriptions',
  'patient_health_tasks',
  'diagnosis_records',
  'patient_restraint_assessments',
  'patient_tube_care_records',
  'patient_evening_care_plans',
  'medication_drug_database',
];

for (const t of tables) {
  const data = await get(`/${encodeURIComponent(t)}?select=*&limit=20000`);
  if (!Array.isArray(data)) { console.log(`\n=== ${t}: 查詢失敗`, JSON.stringify(data).slice(0, 120)); continue; }
  const hits = {};
  const sigValues = {};
  for (const row of data) {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'string' && v.includes('匯入')) {
        const key = `${k}=${v.slice(0, 70)}`;
        hits[key] = (hits[key] || 0) + 1;
      }
      if (typeof v === 'string' && v && /簽|staff|人員|executed_by|recorded_by|created_by|modified_by|signature/i.test(k)) {
        const key = `${k}=${v.slice(0, 40)}`;
        sigValues[key] = (sigValues[key] || 0) + 1;
      }
    }
  }
  console.log(`\n=== ${t}（${data.length} 筆）===`);
  const hitList = Object.entries(hits).sort((a, b) => b[1] - a[1]);
  console.log('含「匯入」:', hitList.length ? hitList.slice(0, 6).map(([k, n]) => `${k} (x${n})`) : '無');
  const sig = Object.entries(sigValues).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log('簽署類欄位:', sig.length ? sig.map(([k, n]) => `${k} (x${n})`) : '無');
}
