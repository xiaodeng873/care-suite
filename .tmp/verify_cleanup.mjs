const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' };
async function count(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { ...H, Range: '0-0' } });
  return r.headers.get('content-range');
}
console.log('drug_db 匯入 notes 剩餘:', await count('/medication_drug_database?select=id&notes=like.*%E5%8C%AF%E5%85%A5*'));
console.log('監測記錄 開發者 剩餘:', await count('/%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84?select=%E8%A8%98%E9%8C%84id&%E8%A8%98%E9%8C%84%E4%BA%BA%E5%93%A1=like.*%E9%96%8B%E7%99%BC%E8%80%85*'));
console.log('rx created_by system_migration 剩餘:', await count('/new_medication_prescriptions?select=id&created_by=eq.system_migration'));
console.log('rx last_modified_by system_migration 剩餘:', await count('/new_medication_prescriptions?select=id&last_modified_by=eq.system_migration'));
