// 匯入 upload/院友疫苗注射記錄表 .xlsx（善頤福群匯出）到 vaccination_records
// 對照：床號+中文姓名（DB 床號有站前綴）；8 個對唔上嘅以姓名/變體字人工映射
// 流程：每個匹配院友先軟刪除舊疫苗記錄（入回收筒），再插入 Excel 記錄
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 8 個床號+姓名對唔上嘅人工映射（床號變咗／異體字）
const NAME_FIX = {
  '鍾熖貞': '鍾焰貞', // C229-1 床號完全吻合
  '何玉𡖖': '何玉卿', // C225-2 床號完全吻合
};

const CATEGORY_MAP = [
  [/肺炎球菌/, '肺炎鏈球菌疫苗'],
  [/流感/, '流感疫苗'],
  [/新冠|XBB|JN\.1|LP\.8/, '新冠疫苗'],
];

const wb = XLSX.readFile('upload/院友疫苗注射記錄表 .xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['院友疫苗注射記錄表'], { header: 1, defval: '' });

const blocks = [];
let cur = null;
for (const r of rows.slice(5)) {
  const bed = String(r[0] ?? '').trim();
  const name = String(r[1] ?? '').trim();
  if (bed) {
    if (bed === '床位號') { cur = null; continue; } // 重複表頭行
    cur = { bed, name, records: [] };
    blocks.push(cur);
  }
  const vaccine = String(r[3] ?? '').trim();
  const date = String(r[4] ?? '').trim();
  if (cur && vaccine) cur.records.push({ vaccine, date });
}
console.log('院友塊:', blocks.length, '記錄:', blocks.reduce((s, b) => s + b.records.length, 0));

const { data: pats } = await supabase
  .from('院友主表')
  .select('院友id,床號,中文姓名,在住狀態');
const normBed = b => String(b || '').replace(/^[A-D]/, '').replace(/\s+/g, '');
const dbByBedName = new Map();
const dbByName = new Map();
for (const p of pats) {
  const key = normBed(p.床號) + '|' + String(p.中文姓名).trim();
  if (!dbByBedName.has(key)) dbByBedName.set(key, []);
  dbByBedName.get(key).push(p);
  const n = String(p.中文姓名).trim();
  if (!dbByName.has(n)) dbByName.set(n, []);
  dbByName.get(n).push(p);
}

const resolve = b => {
  const key = b.bed + '|' + b.name;
  const c1 = dbByBedName.get(key);
  if (c1?.length === 1) return c1[0];
  const fixed = NAME_FIX[b.name] || b.name;
  const c2 = dbByName.get(fixed)?.filter(p => p.在住狀態 === '在住');
  if (c2?.length === 1) return c2[0];
  return null;
};

const toDate = s => {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const categoryOf = v => CATEGORY_MAP.find(([re]) => re.test(v))?.[1] || '其他疫苗';

const matched = [];
const unmatched = [];
for (const b of blocks) {
  const p = resolve(b);
  (p ? matched : unmatched).push({ b, p });
}
console.log('匹配:', matched.length, '對唔上:', unmatched.length);
unmatched.forEach(u => console.log('  UNMATCHED:', u.b.bed, u.b.name));

let delCount = 0, insCount = 0;
for (const { b, p } of matched) {
  // 軟刪舊記錄
  const { data: old } = await supabase.from('vaccination_records').select('id').eq('patient_id', p.院友id);
  for (const o of old || []) {
    const { error } = await supabase.rpc('recycle_soft_delete', {
      p_table: 'vaccination_records', p_id: String(o.id),
      p_reason: '疫苗記錄匯入：以 2026-09 Excel 名單取代舊記錄',
    });
    if (error) { console.error('軟刪舊記錄失敗', p.中文姓名, error.message); process.exit(1); }
    delCount++;
  }
  // 插新記錄
  const rows2 = b.records
    .map(r => ({ vaccine: r.vaccine.replace(/\s+/g, ''), date: toDate(r.date) }))
    .filter(r => r.date);
  if (rows2.length === 0) { console.log(`  ${p.床號} ${p.中文姓名}: 無有效日期記錄，只刪除`); continue; }
  const { error } = await supabase.from('vaccination_records').insert(
    rows2.map(r => ({
      patient_id: p.院友id,
      vaccination_date: r.date,
      vaccine_item: r.vaccine,
      vaccine_category: categoryOf(r.vaccine),
      vaccination_unit: '',
      facility_id: 1,
    }))
  );
  if (error) { console.error('插入失敗', p.中文姓名, error.message); process.exit(1); }
  insCount += rows2.length;
}
console.log(`完成：軟刪舊記錄 ${delCount} 條，插入新記錄 ${insCount} 條，涉及 ${matched.length} 名院友`);
