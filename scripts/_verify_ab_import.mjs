import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const A = 'ab0baf30-65bf-4c5d-b0f4-94cc8ff43d03';
const B = '1b1b78ae-6e87-405d-8f7f-86ee8423c0c3';
const normId = s => String(s || '').toUpperCase().replace(/[\s()（）]/g, '');

const wb = XLSX.readFile('upload/院友個人基本資料 AB.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['院友個人基本資料表'], { header: 1, defval: '' });
const excel = rows.slice(1).filter(r => r[0] || r[2]).map(r => ({
  bed: String(r[0]).trim(), name: String(r[2]).trim(), id: normId(r[5]),
}));

const { data: pats } = await supabase
  .from('院友主表')
  .select('院友id,床號,中文姓名,身份證號碼,在住狀態,station_id,bed_id')
  .in('station_id', [A, B]);
console.log('AB站院友數:', pats.length, '(Excel:', excel.length + ')');

const dbById = new Map(pats.map(p => [normId(p.身份證號碼), p]));
let mismatch = 0;
for (const e of excel) {
  const p = dbById.get(e.id);
  if (!p) { console.log('Excel 冇喺 DB:', e.bed, e.name); mismatch++; continue; }
  const prefix = p.station_id === A ? 'A' : 'B';
  if (p.床號 !== prefix + e.bed && p.床號 !== prefix + e.bed + '-1') {
    console.log('床位唔夾:', e.bed, e.name, 'DB=', p.床號); mismatch++;
  }
  if (p.在住狀態 !== '在住') { console.log('唔係在住:', p.床號, p.中文姓名, p.在住狀態); mismatch++; }
  dbById.delete(e.id);
}
for (const [, p] of dbById) { console.log('DB 冇喺 Excel:', p.床號, p.中文姓名); mismatch++; }
console.log(mismatch === 0 ? '✓ 名單同床位完全一致' : `✗ ${mismatch} 個唔夾`);

const { data: rx } = await supabase
  .from('new_medication_prescriptions')
  .select('id', { count: 'exact', head: true })
  .in('patient_id', pats.map(p => p.院友id))
  .eq('status', 'pending_change');
console.log('仲存在嘅 pending_change 處方:', rx?.length ?? '(query issue)');

const { data: occ } = await supabase.from('beds').select('id').in('station_id', [A, B]).eq('is_occupied', true);
console.log('AB站 occupied 床數:', occ.length);
const noBed = pats.filter(p => !p.bed_id);
console.log('冇 bed_id 嘅院友:', noBed.length);
