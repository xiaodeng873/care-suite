const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
// facility_id 分佈
const r = await fetch(`${BASE}/%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84?select=facility_id&limit=55000`, { headers: H });
const rows = await r.json();
const dist = {};
for (const row of rows) dist[row.facility_id] = (dist[row.facility_id] || 0) + 1;
console.log('監測記錄 facility_id 分佈:', JSON.stringify(dist));
const r2 = await fetch(`${BASE}/facilities?select=*&limit=20`, { headers: H });
console.log('facilities 欄位:', JSON.stringify(await r2.json(), null, 1).slice(0, 1500));
