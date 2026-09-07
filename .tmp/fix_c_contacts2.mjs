const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const fixes = [
  [168, '盧秀英', { 關係: '親屬', 聯絡電話: '63481477', purposes: ['緊急聯絡人'] }],
  [168, '曾先生', { 關係: '朋友', 聯絡電話: '96961136', purposes: ['緊急聯絡人', '其他'] }],
  [168, '何志明', { 關係: '兄弟', 聯絡電話: '98023533', purposes: ['照顧保證人', '緊急聯絡人', '付款保證人'] }],
  [92, '黃穎芝', { 關係: '家人', 聯絡電話: '00000000', purposes: ['緊急聯絡人'] }],
  [55, '鍾國樑', { 關係: '家人', 聯絡電話: '94680436', purposes: ['照顧保證人', '緊急聯絡人', '付款保證人'] }],
  [55, '程婉芬', { 關係: '', 聯絡電話: '98159494', purposes: ['緊急聯絡人'] }],
];
for (const [pid, name, patch] of fixes) {
  const res = await fetch(`${BASE}/patient_contacts?院友id=eq.${pid}&聯絡人姓名=eq.${encodeURIComponent(name)}&facility_id=eq.1`, {
    method: 'PATCH', headers: H, body: JSON.stringify(patch),
  });
  if (!res.ok) { console.error(`失敗 ${name}:`, res.status, await res.text()); process.exit(1); }
  console.log(`已更新 ${name}`);
}
