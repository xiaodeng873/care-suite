const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const tables = ['annual_health_checkups','wound_records','patient_wounds','wounds','patient_wound_assessments','缺席記錄','absence_records','patient_absence_records','incident_reports','infection_control_records'];
for (const t of tables) {
  const r = await fetch(`${BASE}/${t}?select=*&limit=5000`, { headers: H });
  const data = await r.json();
  if (!Array.isArray(data)) { console.log(t, ': 表不存在或失敗'); continue; }
  const hits = {}; const dev = {};
  for (const row of data) for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string' && v.includes('匯入')) hits[`${k}=${v.slice(0,50)}`] = (hits[`${k}=${v.slice(0,50)}`]||0)+1;
    if (typeof v === 'string' && v.includes('開發者')) dev[`${k}=${v.slice(0,30)}`] = (dev[`${k}=${v.slice(0,30)}`]||0)+1;
  }
  console.log(`${t} (${data.length}筆): 匯入=${JSON.stringify(hits)} 開發者=${JSON.stringify(dev)}`);
}
