const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

async function patch(table, filter, body) {
  const r = await fetch(`${BASE}/${table}?${filter}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });
  const text = await r.text();
  console.log(table, r.status, r.ok ? 'OK' : text.slice(0, 200));
}

// 1. 藥物資料庫 notes 含「匯入」→ 清空
await patch('medication_drug_database', 'notes=like.*%E5%8C%AF%E5%85%A5*', { notes: null });
// 2. 健康監測記錄 記錄人員 含「開發者」→ NULL
await patch('%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84', '%E8%A8%98%E9%8C%84%E4%BA%BA%E5%93%A1=like.*%E9%96%8B%E7%99%BC%E8%80%85*', { '記錄人員': null });
// 3. 處方 created_by / last_modified_by = system_migration → NULL
await patch('new_medication_prescriptions', 'created_by=eq.system_migration', { created_by: null, last_modified_by: null });
