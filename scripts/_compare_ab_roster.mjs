// Read-only comparison: DB current A/B station residents vs 院友個人基本資料 AB.csv
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const normId = s => String(s || '').toUpperCase().replace(/[\s()（）]/g, '');
const normBed = s => String(s || '').replace(/^([ABD])(\d+-)/i, '$2');

// --- CSV ---
const lines = readFileSync('upload/院友個人基本資料 AB.csv', 'utf8').replace(/^﻿/, '').split(/\r?\n/);
const header = lines[0].split(',');
const idx = k => header.indexOf(k);
const csvRows = [];
const csvDupes = [];
const seen = new Map();
for (const ln of lines.slice(1)) {
  if (!ln.trim()) continue;
  const c = ln.split(',');
  const id = normId(c[idx('證件編號')]);
  const name = c[idx('中文姓名')];
  const rec = {
    bed: c[idx('床位號')].trim(),
    sc: c[idx('服務編號')].trim(),
    name,
    en: c[idx('英文姓名')].trim(),
    idRaw: c[idx('證件編號')].trim(),
    id,
    admit: c[idx('入住日期')].trim(),
    type: c[idx('入住類型')].trim(),
    nursing: c[idx('護理等級')].trim(),
    gender: c[idx('性別')].trim(),
    dob: c[idx('出生日期')].trim(),
  };
  if (seen.has(id)) csvDupes.push(rec);
  else { seen.set(id, rec); csvRows.push(rec); }
}

// --- DB ---
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
const A = 'ab0baf30-65bf-4c5d-b0f4-94cc8ff43d03';
const B = '1b1b78ae-6e87-405d-8f7f-86ee8423c0c3';

const { data: beds, error: bedsErr } = await sb.from('beds').select('id,bed_number,station_id');
if (bedsErr) { console.error('beds error', bedsErr); process.exit(1); }
const bedMap = new Map(beds.map(b => [b.id, b]));

// all in-residence patients with bed info
let all = [], from = 0;
while (true) {
  const { data, error } = await sb.from('院友主表').select('院友id,床號,中文姓名,身份證號碼,在住狀態,station_id,bed_id,original_bed_id,bed_transfer_type,入住日期,護理等級,入住類型,性別,出生日期').eq('在住狀態', '在住').range(from, from + 999);
  if (error) { console.error('patients error', error); process.exit(1); }
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

const bedStation = pid => pid && bedMap.get(pid)?.station_id;
// A/B roster = current bed in A/B, or temporarily transferred WITH original bed in A/B
const abPatients = all.filter(p => {
  const cur = bedStation(p.bed_id);
  const orig = bedStation(p.original_bed_id);
  return cur === A || cur === B || orig === A || orig === B;
});
const awayTemp = abPatients.filter(p => {
  const cur = bedStation(p.bed_id);
  const orig = bedStation(p.original_bed_id);
  return (cur === A || cur === B) === false && orig; // stationed/listed via original bed
});

const dbById = new Map();
for (const p of abPatients) {
  const k = normId(p.身份證號碼);
  if (!k || k === 'NULL') continue;
  if (dbById.has(k)) console.log('!! DB duplicate ID in A/B roster:', k, p.院友id, p.床號, dbById.get(k).院友id, dbById.get(k).床號);
  dbById.set(k, p);
}

const csvById = new Map(csvRows.map(r => [r.id, r]));

// --- diff ---
const missingInDb = csvRows.filter(r => !dbById.has(r.id));
const extraInDb = [...dbById.values()].filter(p => !csvById.has(normId(p.身份證號碼)));
const bedDiff = [], fieldDiff = [];
for (const [k, p] of dbById) {
  const r = csvById.get(k);
  if (!r) continue;
  const dbBed = normBed(p.床號);
  if (dbBed !== r.bed) bedDiff.push({ id: k, name: r.name, csvBed: r.bed, dbBed: p.床號, pid: p.院友id });
  else fieldDiff.push(compareFields(r, p));
}
const fieldIssues = fieldDiff.filter(Boolean);

function compareFields(r, p) {
  const issues = [];
  if (r.name !== p.中文姓名) issues.push(`姓名: CSV=${r.name} DB=${p.中文姓名}`);
  const csvG = r.gender === '男' ? '男' : r.gender === '女' ? '女' : r.gender;
  if (csvG && p.性別 && csvG !== p.性別) issues.push(`性別: CSV=${csvG} DB=${p.性別}`);
  const csvDob = r.dob.slice(0, 10);
  const dbDob = String(p.出生日期 || '').slice(0, 10);
  if (csvDob && dbDob && csvDob !== dbDob) issues.push(`出生日期: CSV=${csvDob} DB=${dbDob}`);
  const csvAdm = r.admit;
  const dbAdm = String(p.入住日期 || '').slice(0, 10);
  if (csvAdm && dbAdm && csvAdm !== dbAdm) issues.push(`入住日期: CSV=${csvAdm} DB=${dbAdm}`);
  const NMAP = { '高度照顧': '全護理', '中度照顧': '半護理', '低度照顧': '自理' };
  if (r.nursing && p.護理等級 && NMAP[r.nursing] && NMAP[r.nursing] !== p.護理等級)
    issues.push(`護理等級: CSV=${r.nursing}(${NMAP[r.nursing]}) DB=${p.護理等級}`);
  const TMAP = { '買位月費': ['買位'], '私位月費': ['私位'], '暫托': ['暫住'], '院舍卷': ['院舍卷', '院舍劵'] };
  const ok = TMAP[r.type]?.some(t => String(p.入住類型 || '').includes(t));
  if (r.type && p.入住類型 && TMAP[r.type] && !ok) issues.push(`入住類型: CSV=${r.type} DB=${p.入住類型}`);
  return issues.length ? { id: r.id, name: r.name, issues } : null;
}

console.log(`CSV rows: ${lines.length - 2 + 1}, unique by ID: ${csvRows.length}, CSV duplicates: ${csvDupes.length}`);
console.log(`DB 在住(A/B 含暫調): ${abPatients.length} (其中暫調離開A/B: ${awayTemp.length})`);
console.log('\n=== 1) CSV 有 / DB 冇 (漏咗) ===');
for (const r of missingInDb) console.log(`  ${r.id} ${r.name} 床=${r.bed} 服務編號=${r.sc}`);
console.log('\n=== 2) DB 有 / CSV 冇 (多咗) ===');
for (const p of extraInDb) console.log(`  ${normId(p.身份證號碼)} ${p.中文姓名} 床=${p.床號} pid=${p.院友id} 暫調=${p.bed_transfer_type || '-'} 原床=${p.original_bed_id ? bedMap.get(p.original_bed_id)?.bed_number : '-'}`);
console.log('\n=== 3) 床號唔同 ===');
for (const d of bedDiff) console.log(`  ${d.id} ${d.name} CSV=${d.csvBed} DB=${d.dbBed}`);
console.log('\n=== 4) 其他欄位差異 ===');
for (const f of fieldIssues) console.log(`  ${f.id} ${f.name}\n    ${f.issues.join('\n    ')}`);
console.log('\n=== 暫調離開 A/B 嘅人 ===');
for (const p of awayTemp) console.log(`  ${normId(p.身份證號碼)} ${p.中文姓名} 原床=${bedMap.get(p.original_bed_id)?.bed_number} 現床=${p.床號} (${p.bed_transfer_type})`);
