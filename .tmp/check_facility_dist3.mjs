const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' };
async function count(f) {
  const r = await fetch(`${BASE}/%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84?select=facility_id&${f}`, { headers: { ...H, Range: '0-0' } });
  return r.headers.get('content-range');
}
console.log('facility 1:', await count('facility_id=eq.1'));
console.log('facility 2:', await count('facility_id=eq.2'));
console.log('NULL:', await count('facility_id=is.null'));
// 近180日 cutoff 內的分佈（與啟動查詢一致）
const cutoff = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
const f = `%E8%A8%98%E9%8C%84%E6%97%A5%E6%9C%9F=gte.${cutoff}`;
console.log('近180日 facility 1:', await count(`facility_id=eq.1&${f}`));
console.log('近180日 facility 2:', await count(`facility_id=eq.2&${f}`));
console.log('近180日 NULL:', await count(`facility_id=is.null&${f}`));
