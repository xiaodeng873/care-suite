import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const wb = XLSX.readFile('upload/院友疫苗注射記錄表 .xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['院友疫苗注射記錄表'], { header: 1, defval: '' });

// 逐行解析：有床位號=新院友塊；之後空床位行歸上一個院友
const blocks = [];
let cur = null;
for (const r of rows.slice(5)) {
  const bed = String(r[0] ?? '').trim();
  const name = String(r[1] ?? '').trim();
  if (bed) {
    cur = { bed, name, svcNo: String(r[2] ?? '').trim(), records: [] };
    blocks.push(cur);
  }
  const vaccine = String(r[3] ?? '').trim();
  const date = String(r[4] ?? '').trim();
  if (cur && vaccine) cur.records.push({ vaccine, date, nextDate: String(r[5] ?? '').trim(), remark: String(r[6] ?? '').trim() });
}
console.log('院友塊數:', blocks.length, '疫苗記錄總數:', blocks.reduce((s, b) => s + b.records.length, 0));

// 全部在住院友（以床號+姓名對照）
const { data: pats } = await supabase
  .from('院友主表')
  .select('院友id,床號,中文姓名,身份證號碼,station_id,在住狀態');
console.log('DB 院友數:', pats.length);

// 床號正規化：DB 床號有站前綴（A103-2）；Excel 冇
const normBed = b => String(b || '').replace(/^[A-D]/, '').replace(/\s+/g, '');
const dbByBedName = new Map();
for (const p of pats) {
  const key = normBed(p.床號) + '|' + String(p.中文姓名).trim();
  if (!dbByBedName.has(key)) dbByBedName.set(key, []);
  dbByBedName.get(key).push(p);
}

const matched = [];
const unmatched = [];
for (const b of blocks) {
  const key = b.bed + '|' + b.name;
  const cand = dbByBedName.get(key);
  if (cand && cand.length === 1) matched.push({ b, p: cand[0] });
  else if (cand && cand.length > 1) {
    // 同名同床號（唔同站）：用服務編號分唔到，先咁報告
    unmatched.push({ b, reason: '多重匹配 ' + cand.map(c => c.床號).join('/') });
  } else unmatched.push({ b, reason: '床號+姓名對唔上' });
}
console.log('匹配:', matched.length, '對唔上:', unmatched.length);
unmatched.forEach(u => console.log('  ', u.b.bed, u.b.name, u.b.svcNo, `(${u.b.records.length} 條)`, u.reason));

// 疫苗項目清單
const items = new Set();
blocks.forEach(b => b.records.forEach(r => items.add(r.vaccine)));
console.log('疫苗項目種類:', items.size);
[...items].forEach(i => console.log('  -', i));
