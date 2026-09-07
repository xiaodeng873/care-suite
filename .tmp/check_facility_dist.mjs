const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const r = await fetch(`${BASE}/%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84?select=facility_id&facility_id=is.null`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
console.log('facility_id NULL 行數:', r.headers.get('content-range'));
const r2 = await fetch(`${BASE}/%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84?select=facility_id&facility_id=not.is.null`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
console.log('facility_id 非 NULL 行數:', r2.headers.get('content-range'));
const r3 = await fetch(`${BASE}/facilities?select=id,name_zh,is_active,auth_epoch`, { headers: H });
console.log('院舍:', JSON.stringify(await r3.json()));
