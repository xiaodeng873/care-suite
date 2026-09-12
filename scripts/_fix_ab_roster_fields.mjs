// Fix 6 residents' fields per 院友個人基本資料 AB.csv (劉志 keeps DB 全護理, no change)
import { createClient } from '@supabase/supabase-js';

const normId = s => String(s || '').toUpperCase().replace(/[\s()（）]/g, '');
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

// CSV source of truth; 入住類型/護理等級 use DB vocabulary (買位/私位/暫住, 全護理/半護理)
const fixes = [
  { key: 'B3900210', name: '李銀芳', patch: { 入住日期: '2023-05-05', 護理等級: '全護理' } },
  { key: 'E1251507', name: '林佩端', patch: { 入住日期: '2024-07-31', 護理等級: '半護理' } },
  { key: 'G5796902', name: '黃志強', patch: { 入住日期: '2026-08-27', 護理等級: '半護理', 入住類型: '暫住' } },
  { key: 'E2664953', name: '曾楚然', patch: { 入住日期: '2023-02-27', 護理等級: '全護理' } },
  { key: 'R1943781', name: '李道中', patch: { 入住日期: '2026-03-12', 入住類型: '私位' } },
  { key: 'B7271080', name: '李玉嬋', patch: { 入住日期: '2023-02-06', 護理等級: '全護理', 入住類型: '買位' } },
];

const { data: patients, error } = await sb.from('院友主表')
  .select('院友id,床號,中文姓名,身份證號碼,在住狀態,入住日期,護理等級,入住類型')
  .eq('在住狀態', '在住');
if (error) { console.error(error); process.exit(1); }

for (const f of fixes) {
  const matches = patients.filter(p => normId(p.身份證號碼) === f.key);
  if (matches.length !== 1) { console.log(`SKIP ${f.name}: matches=${matches.length}`); continue; }
  const p = matches[0];
  const { error: upErr } = await sb.from('院友主表').update(f.patch).eq('院友id', p.院友id);
  console.log(upErr ? `FAIL ${f.name}: ${JSON.stringify(upErr)}` : `OK   ${f.name} (${p.床號}) <- ${JSON.stringify(f.patch)}`);
}
