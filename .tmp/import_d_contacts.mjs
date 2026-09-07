// 匯入 D 站院友聯絡人清單（upload/D站聯絡人清單.csv，來源：用戶聯絡人清單D.xlsx）
// 映射：手機號碼→聯絡電話；其它電話→備註；聯絡用途(;)→purposes[]；is_primary=false
// D 站同屬 facility 1（善頤福群），院友以全院中文姓名匹配
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

import { readFileSync } from 'node:fs';
const raw = readFileSync('upload/D站聯絡人清單.csv', 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/).filter(l => l.trim());
const rows = lines.slice(1).map((l, i) => {
  const f = l.split(',');
  if (f.length !== 7) console.error(`第 ${i + 2} 行欄數 ${f.length} ≠ 7: ${l}`);
  return f;
});
console.log(`CSV 資料行: ${rows.length}`);

// 院友對照：facility_id=1 全院，中文姓名精確匹配；重名取「在住」
const patients = await fetch(
  `${BASE}/院友主表?facility_id=eq.1&select=院友id,中文姓名,在住狀態,床號&limit=5000`,
  { headers: H }
).then(r => r.json());
if (!Array.isArray(patients)) { console.error('院友查詢失敗', patients); process.exit(1); }

const byName = new Map();
for (const p of patients) {
  if (!byName.has(p.中文姓名)) byName.set(p.中文姓名, []);
  byName.get(p.中文姓名).push(p);
}
const resolve = (name) => {
  const list = byName.get(name);
  if (!list) return { pid: null, note: '未匹配' };
  if (list.length === 1) return { pid: list[0].院友id, note: '' };
  const resident = list.find(p => p.在住狀態 === '在住');
  const chosen = resident || list[0];
  return { pid: chosen.院友id, note: `重名${list.length}條，取${chosen.在住狀態 || '?'}(${chosen.床號 || '無床號'})` };
};

// 既有聯絡人去重：院友id + 聯絡人姓名
const existing = await fetch(
  `${BASE}/patient_contacts?facility_id=eq.1&select=院友id,聯絡人姓名&limit=10000`,
  { headers: H }
).then(r => r.json());
if (!Array.isArray(existing)) { console.error('聯絡人查詢失敗', existing); process.exit(1); }
console.log(`既有聯絡人: ${existing.length} 筆`);

const dup = (pid, name) => existing.some(e => e.院友id === pid && e.聯絡人姓名 === name);

const toInsert = [];
const skipped = [];
const unmatched = [];
const notes = [];
for (const [pname, cname, rel, mobile, other, purpose] of rows) {
  const { pid, note } = resolve(pname);
  if (note) notes.push(`${pname}: ${note}`);
  if (!pid) { unmatched.push(`${pname} / ${cname}`); continue; }
  if (dup(pid, cname)) { skipped.push(`${pname} / ${cname}（已存在）`); continue; }
  toInsert.push({
    院友id: pid,
    聯絡人姓名: cname,
    關係: rel || '',
    聯絡電話: mobile || '',
    備註: other ? `其它電話: ${other}` : '',
    purposes: purpose ? purpose.split(';').filter(Boolean) : [],
    is_primary: false,
    facility_id: 1,
  });
}

if (notes.length) { console.log('\n院友匹配備註:'); [...new Set(notes)].forEach(n => console.log(' ', n)); }
console.log(`\n準備匯入 ${toInsert.length} 筆，跳過 ${skipped.length} 筆，未匹配 ${unmatched.length} 筆`);
if (skipped.length) { console.log('跳過明細:'); skipped.forEach(s => console.log(' ', s)); }
if (unmatched.length) { console.log('未匹配明細:'); unmatched.forEach(s => console.log(' ', s)); }
if (!toInsert.length) { console.log('無需匯入'); process.exit(0); }

const res = await fetch(`${BASE}/patient_contacts`, {
  method: 'POST',
  headers: { ...H, Prefer: 'return=representation' },
  body: JSON.stringify(toInsert),
});
const body = await res.json();
if (!res.ok) {
  console.error('匯入失敗:', res.status, JSON.stringify(body).slice(0, 800));
  process.exit(1);
}
console.log(`成功匯入 ${body.length} 筆`);
