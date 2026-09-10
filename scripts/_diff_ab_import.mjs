import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const A = 'ab0baf30-65bf-4c5d-b0f4-94cc8ff43d03';
const B = '1b1b78ae-6e87-405d-8f7f-86ee8423c0c3';

const normId = s => String(s || '').toUpperCase().replace(/[\s()（）]/g, '');

// Excel
const wb = XLSX.readFile('upload/院友個人基本資料 AB.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['院友個人基本資料表'], { header: 1, defval: '' });
const excel = rows.slice(1).filter(r => r[0] || r[2]).map(r => ({
  bed: String(r[0]).trim(),
  name: String(r[2]).trim(),
  enName: String(r[3]).trim(),
  id: normId(r[5]),
  idRaw: String(r[5]).trim(),
  admit: String(r[6]).trim(),
  gender: String(r[10]).trim(),
  dob: String(r[13]).trim(),
}));

// DB
const { data: pats } = await supabase
  .from('院友主表')
  .select('院友id,床號,中文姓名,身份證號碼,入住日期,station_id,bed_id')
  .in('station_id', [A, B]);
const db = (pats || []).map(p => ({ ...p, nid: normId(p.身份證號碼) }));

const dbById = new Map(db.map(p => [p.nid, p]));
const excelById = new Map(excel.map(e => [e.id, e]));

const updates = [];   // matched by ID, bed changed
const sameBed = [];
const idMatchedButMoved = [];
const excelUnmatched = [];
const dbUnmatched = [];

for (const e of excel) {
  const p = dbById.get(e.id);
  if (!p) { excelUnmatched.push(e); continue; }
  const prefix = p.station_id === A ? 'A' : 'B';
  const targetBed = prefix + e.bed;
  if (p.床號 === targetBed) sameBed.push({ e, p });
  else updates.push({ e, p, targetBed });
}

const matchedIds = new Set(excel.map(e => e.id));
for (const p of db) if (!matchedIds.has(p.nid)) dbUnmatched.push(p);

console.log(`Excel rows: ${excel.length}, DB AB patients: ${db.length}`);
console.log(`\n=== same bed (${sameBed.length}) ===`);
console.log(`\n=== update bed (${updates.length}) ===`);
updates.forEach(u => console.log(`${u.p.床號} -> ${u.targetBed}  ${u.e.name}  ${u.e.id}`));
console.log(`\n=== excel unmatched by ID (${excelUnmatched.length}) ===`);
excelUnmatched.forEach(e => console.log(`${e.bed}  ${e.name}  ${e.id}`));
console.log(`\n=== db unmatched by ID (${dbUnmatched.length}) ===`);
dbUnmatched.forEach(p => console.log(`${p.床號}  ${p.中文姓名}  ${p.身份證號碼}`));

// try name-match for excel unmatched
console.log(`\n=== name match for excel unmatched ===`);
const dbUnmatchedNames = new Map(dbUnmatched.map(p => [String(p.中文姓名).trim(), p]));
for (const e of excelUnmatched) {
  const p = dbUnmatchedNames.get(e.name);
  console.log(`${e.bed} ${e.name} ${e.id} ->`, p ? `MATCH ${p.床號} ${p.身份證號碼}` : 'NO MATCH');
}

// prescriptions pending_change for AB patients
const patIds = db.map(p => p.院友id);
const { data: rx } = await supabase
  .from('new_medication_prescriptions')
  .select('id, patient_id, medication_name, status')
  .in('patient_id', patIds)
  .eq('status', 'pending_change');
console.log(`\n=== AB站 pending_change prescriptions: ${rx?.length ?? 0} ===`);
const byPat = {};
rx?.forEach(r => { byPat[r.patient_id] = (byPat[r.patient_id] || 0) + 1; });
console.log('patients affected:', Object.keys(byPat).length);
