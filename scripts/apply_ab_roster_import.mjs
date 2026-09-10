// 福群A/B站在住院友名單重匯入（upload/院友個人基本資料 AB.xlsx → 院友主表 + beds）
// 對照鍵：身份證號碼（正規化）。Excel 有 DB 冇 → 新增；DB 有 Excel 冇 → 軟刪除；兩邊有 → 更新床位。
// 另外軟刪除 AB 站所有 status='pending_change'（待變更）處方。
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const A = 'ab0baf30-65bf-4c5d-b0f4-94cc8ff43d03';
const B = '1b1b78ae-6e87-405d-8f7f-86ee8423c0c3';
const normId = s => String(s || '').toUpperCase().replace(/[\s()（）]/g, '');
const fmtId = s => String(s || '').toUpperCase().replace(/\s+/g, '');
// Excel 值 → DB enum 值對照（對唔到就 null，唔亂估）
const ADMIT_TYPE_MAP = { '買位月費': '買位', '私位月費': '私位', '暫托': '暫住', '暫託': '暫住', '院舍卷': '院舍卷級別0' };
const NURSING_MAP = { '高度照顧': '全護理', '中度照顧': '半護理', '低度照顧': '自理' };
const mapOrNull = (v, m) => m[String(v || '').trim()] || null;

const wb = XLSX.readFile('upload/院友個人基本資料 AB.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['院友個人基本資料表'], { header: 1, defval: '' });
const excel = rows.slice(1).filter(r => r[0] || r[2]).map(r => ({
  bed: String(r[0]).trim(),
  name: String(r[2]).trim(),
  enName: String(r[3]).trim(),
  id: normId(r[5]),
  idFmt: fmtId(r[5]),
  admit: String(r[6]).trim() || null,
  gender: String(r[10]).trim() || null,
  dob: String(r[12]).trim() === '年月日' ? String(r[13]).trim() : null,
  nursing: String(r[9]).trim() || null,
  admitType: String(r[8]).trim() || null,
}));

const { data: pats } = await supabase
  .from('院友主表')
  .select('院友id,床號,中文姓名,身份證號碼,station_id,bed_id')
  .in('station_id', [A, B]);
const db = (pats || []).map(p => ({ ...p, nid: normId(p.身份證號碼) }));
const dbById = new Map(db.map(p => [p.nid, p]));

const { data: beds } = await supabase.from('beds').select('id,station_id,bed_number,is_occupied').in('station_id', [A, B]);
const bedByNum = new Map(beds.map(b => [b.bed_number, b]));

const resolveBed = (e, stationId) => {
  const prefix = stationId === A ? 'A' : 'B';
  for (const cand of [prefix + e.bed, prefix + e.bed + '-1']) {
    const b = bedByNum.get(cand);
    if (b) return b;
  }
  return null;
};

const excelUnmatched = excel.filter(e => !dbById.has(e.id));
const dbUnmatched = db.filter(p => !excel.some(e => e.id === p.nid));
const pairs = excel.map(e => ({ e, p: dbById.get(e.id) })).filter(x => x.p);

// beds to free = unmatched patients' beds (do deletes first)
const bedsToFree = new Set();
for (const p of dbUnmatched) {
  if (p.bed_id) bedsToFree.add(p.bed_id);
  const { error } = await supabase.rpc('recycle_soft_delete', {
    p_table: '院友主表', p_id: String(p.院友id),
    p_reason: 'AB站名單重匯入：2026-09 Excel 名單對不上，依指示刪除',
  });
  if (error) { console.error('刪除院友失敗', p.床號, p.中文姓名, error.message); process.exit(1); }
  console.log(`已刪除院友 ${p.床號} ${p.中文姓名} ${p.身份證號碼}`);
}

// bed updates for matched（兩段式：床有位 unique constraint，先清後上，處理對調床位）
const bedsToOccupy = new Set();
const bedChanges = [];
for (const { e, p } of pairs) {
  const bed = resolveBed(e, p.station_id);
  if (!bed) { console.error('找不到床', e.bed, e.name); process.exit(1); }
  if (p.bed_id && p.bed_id !== bed.id) bedsToFree.add(p.bed_id);
  bedsToOccupy.add(bed.id);
  if (bed.id !== p.bed_id || p.床號 !== bed.bed_number) bedChanges.push({ e, p, bed });
}
// 第一段：將要變床嘅院友 bed_id 置 NULL（避開對調衝突）
for (const { p } of bedChanges) {
  const { error } = await supabase.from('院友主表').update({ bed_id: null }).eq('院友id', p.院友id);
  if (error) { console.error('清空 bed_id 失敗', p.中文姓名, error.message); process.exit(1); }
}
// 第二段：上新床
for (const { e, p, bed } of bedChanges) {
    const { error } = await supabase.from('院友主表')
      .update({ 床號: bed.bed_number, bed_id: bed.id })
      .eq('院友id', p.院友id);
    if (error) { console.error('更新床位失敗', e.name, error.message); process.exit(1); }
    console.log(`已更新床位 ${p.床號} -> ${bed.bed_number} ${e.name}`);
}

// inserts for excel-unmatched
for (const e of excelUnmatched) {
  // 站別由床號推斷：床位存在邊個站就用邊個
  let bed = resolveBed(e, A) || resolveBed(e, B);
  if (!bed) { console.error('新院友找不到床', e.bed, e.name); process.exit(1); }
  const { data: inserted, error } = await supabase.from('院友主表')
    .insert({
      床號: bed.bed_number,
      中文姓名: e.name,
      英文姓名: e.enName || null,
      性別: e.gender,
      身份證號碼: e.idFmt,
      出生日期: e.dob,
      入住日期: e.admit,
      護理等級: mapOrNull(e.nursing, NURSING_MAP),
      入住類型: mapOrNull(e.admitType, ADMIT_TYPE_MAP),
      在住狀態: '在住',
      is_hospitalized: false,
      station_id: bed.station_id,
      bed_id: bed.id,
      facility_id: 1,
      首次記錄日期: new Date().toISOString().slice(0, 10),
    })
    .select('院友id')
    .single();
  if (error) { console.error('新增院友失敗', e.name, error.message); process.exit(1); }
  console.log(`已新增院友 ${bed.bed_number} ${e.name} ${e.idFmt}`);
  bedsToOccupy.add(bed.id);
}

// fix bed occupancy
for (const id of bedsToFree) {
  if (bedsToOccupy.has(id)) continue;
  await supabase.from('beds').update({ is_occupied: false }).eq('id', id);
}
for (const id of bedsToOccupy) {
  await supabase.from('beds').update({ is_occupied: true }).eq('id', id);
}
console.log(`床位狀態已修正：free=${[...bedsToFree].length} occupy=${[...bedsToOccupy].length}`);

// delete pending_change prescriptions for all AB patients (including deleted ones' — still referenced by patient_id)
const allPatIds = db.map(p => p.院友id);
const { data: rx } = await supabase
  .from('new_medication_prescriptions')
  .select('id, patient_id, medication_name')
  .in('patient_id', allPatIds)
  .eq('status', 'pending_change');
let rxDeleted = 0;
for (const r of rx || []) {
  const { error } = await supabase.rpc('recycle_soft_delete', {
    p_table: 'new_medication_prescriptions', p_id: String(r.id),
    p_reason: 'AB站名單重匯入：依指示刪除所有待變更處方',
  });
  if (error) { console.error('刪除處方失敗', r.id, error.message); process.exit(1); }
  rxDeleted++;
}
console.log(`已刪除待變更處方 ${rxDeleted} 張`);
console.log('DONE');
