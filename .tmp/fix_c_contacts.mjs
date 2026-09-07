const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const rows = [
  { 院友id: 168, 聯絡人姓名: '盧秀英', 關係: '', 聯絡電話: '', 備註: '', purposes: [], is_primary: false, facility_id: 1 },
  { 院友id: 168, 聯絡人姓名: '曾先生', 關係: '', 聯絡電話: '', 備註: '', purposes: [], is_primary: false, facility_id: 1 },
  { 院友id: 168, 聯絡人姓名: '何志明', 關係: '', 聯絡電話: '', 備註: '', purposes: [], is_primary: false, facility_id: 1 },
  { 院友id: 92, 聯絡人姓名: '黃穎芝', 關係: '', 聯絡電話: '', 備註: '', purposes: [], is_primary: false, facility_id: 1 },
  { 院友id: 55, 聯絡人姓名: '鍾國樑', 關係: '', 聯絡電話: '', 備註: '', purposes: [], is_primary: false, facility_id: 1 },
  { 院友id: 55, 聯絡人姓名: '程婉芬', 關係: '', 聯絡電話: '', 備註: '', purposes: [], is_primary: false, facility_id: 1 },
];
const res = await fetch(`${BASE}/patient_contacts`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(rows) });
const body = await res.json();
if (!res.ok) { console.error('失敗:', res.status, JSON.stringify(body).slice(0, 500)); process.exit(1); }
console.log(`補匯 ${body.length} 筆`);
