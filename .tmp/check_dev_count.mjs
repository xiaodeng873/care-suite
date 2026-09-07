const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' };
async function count(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { ...H, Range: '0-0' } });
  return r.headers.get('content-range');
}
console.log('健康監測記錄 total:', await count('/%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84?select=%E8%A8%98%E9%8C%84id'));
console.log('健康監測記錄 開發者:', await count('/%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84?select=%E8%A8%98%E9%8C%84id&%E8%A8%98%E9%8C%84%E4%BA%BA%E5%93%A1=like.*%E9%96%8B%E7%99%BC%E8%80%85*'));
console.log('drug_db notes 匯入:', await count('/medication_drug_database?select=id&notes=like.*%E5%8C%AF%E5%85%A5*'));
console.log('rx system_migration:', await count('/new_medication_prescriptions?select=id&created_by=eq.system_migration'));
// 其他表是否也有「開發者」
const tables2 = ['patient_health_tasks','medication_workflow_records','diagnosis_records','patient_tube_care_records','patient_restraint_assessments','meal_guidance','intake_output_records','cgat_records'];
for (const t of tables2) {
  const r = await fetch(`${BASE}/${t}?select=*&limit=5000`, { headers: H });
  const data = await r.json();
  if (!Array.isArray(data)) { console.log(t, 'fail'); continue; }
  const hits = {};
  for (const row of data) for (const [k, v] of Object.entries(row))
    if (typeof v === 'string' && v.includes('開發者')) hits[`${k}=${v.slice(0,30)}`] = (hits[`${k}=${v.slice(0,30)}`]||0)+1;
  console.log(t, Object.keys(hits).length ? hits : '無開發者');
}
