// 匯入 upload/院友藥物反應設置管理報表 (C)/(D).xlsx 到 院友主表.藥物敏感 / 不良藥物反應
// 忽略「院友用藥備註」及「最後更新日期及更新人」兩欄
// 解析：按 ; 、 , 及列舉前綴 (1) 1) 1. 拆項；單獨 NKDA 視為無記錄（系統以空陣列代表 NKDA）
// 去重：院友現有陣列 + 新項目 case-insensitive 去重，保留首次出現原文
// 注意：legacy API key 已停用，改用 Management API (SUPABASE_ACCESS_TOKEN)
// 用法：node --env-file=.env scripts/import_drug_reactions.mjs [--apply]
import ExcelJS from '@zurmokeeper/exceljs';

const APPLY = process.argv.includes('--apply');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0];
if (!token) {
  console.error('❌ 請設定 SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL 失敗 (${res.status}): ${await res.text()}\n${query.slice(0, 200)}`);
  return res.json();
}

const esc = s => String(s).replace(/'/g, "''");
const toJsonbLiteral = arr => `'${esc(JSON.stringify(arr))}'::jsonb`;

const FILES = [
  ['C', 'upload/院友藥物反應設置管理報表 (C).xlsx'],
  ['D', 'upload/院友藥物反應設置管理報表(D).xlsx'],
];

// 異體字人工映射（同疫苗匯入）
const NAME_FIX = {
  '鍾熖貞': '鍾焰貞',
  '何玉𡖖': '何玉卿',
  '何志廉': '何志亷', // C221-1 床號吻合，異體字
};

function parseItems(raw) {
  let s = String(raw ?? '').trim();
  if (!s || s === '--') return [];
  // NKDA(Allergy :beef, SHRIMP) → 取括號內真正敏感項目
  const nkdaNote = s.match(/^NKDA\s*[\(（]\s*Allergy\s*[:：]?\s*(.+?)[\)）]\s*$/i);
  if (nkdaNote) s = nkdaNote[1];
  return s
    .split(/[;、,]|\s*\(\d+\)\s*|\s*\d+\)\s*|\s+\d+\.\s*|^\d+\.\s*/)
    .map(p => p.replace(/^\s*\(?\d+\s*[\)\.]\s*/, '').trim())
    .filter(Boolean)
    .filter(p => !/^NKDA$/i.test(p));
}

const norm = s => String(s).toUpperCase().replace(/\s+/g, ' ').trim();

// 讀 Excel
const excelRows = [];
for (const [station, file] of FILES) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= 4) return; // 標題 3 行 + 表頭 1 行
    const v = row.values;
    const bed = String(v[1] ?? '').trim();
    const name = String(v[4] ?? '').trim();
    if (!bed || !name) return;
    excelRows.push({
      station,
      bed,
      name,
      allergies: parseItems(v[5]),
      adrs: parseItems(v[6]),
    });
  });
}
console.log(`Excel 院友列: ${excelRows.length}`);

// 讀 DB 院友
const pats = await sql('SELECT "院友id","床號","中文姓名","在住狀態","藥物敏感","不良藥物反應" FROM "院友主表"');
console.log(`DB 院友: ${pats.length}`);

const normBed = b => String(b || '').replace(/^[A-D]/i, '').replace(/\s+/g, '');
const dbByBedName = new Map();
const dbByName = new Map();
for (const p of pats) {
  const bk = normBed(p.床號) + '|' + String(p.中文姓名).trim();
  if (!dbByBedName.has(bk)) dbByBedName.set(bk, []);
  dbByBedName.get(bk).push(p);
  const nk = String(p.中文姓名).trim();
  if (!dbByName.has(nk)) dbByName.set(nk, []);
  dbByName.get(nk).push(p);
}

const preferInResidence = list =>
  list.find(p => p.在住狀態 === '在住') || list[0];

const unmatched = [];
const updates = [];

for (const row of excelRows) {
  if (row.allergies.length === 0 && row.adrs.length === 0) continue;
  const fixedName = NAME_FIX[row.name] || row.name;
  let patient = null;
  const c1 = dbByBedName.get(row.bed + '|' + fixedName);
  if (c1?.length) patient = preferInResidence(c1);
  if (!patient) {
    const c2 = dbByName.get(fixedName);
    if (c2?.length === 1) patient = c2[0];
  }
  if (!patient) {
    unmatched.push(`${row.station} | ${row.bed} | ${row.name} | A=${row.allergies.join('; ')} | R=${row.adrs.join('; ')}`);
    continue;
  }

  const existingA = Array.isArray(patient.藥物敏感) ? patient.藥物敏感 : [];
  const existingR = Array.isArray(patient.不良藥物反應) ? patient.不良藥物反應 : [];
  const merge = (existing, incoming) => {
    const seen = new Set(existing.map(norm));
    const added = [];
    for (const item of incoming) {
      if (!seen.has(norm(item))) {
        seen.add(norm(item));
        added.push(item);
      }
    }
    return { merged: [...existing, ...added], added };
  };
  const a = merge(existingA, row.allergies);
  const r = merge(existingR, row.adrs);
  if (a.added.length === 0 && r.added.length === 0) {
    console.log(`= 無新增 ${row.station} ${row.bed} ${patient.中文姓名}（全部重複）`);
    continue;
  }
  updates.push({ patient, mergedA: a.merged, mergedR: r.merged, addA: a.added, addR: r.added, row });
}

console.log('\n=== 無法配對 ===');
unmatched.forEach(u => console.log(u));
console.log(`\n準備更新 ${updates.length} 位院友：`);
for (const u of updates) {
  console.log(`+ ${u.row.station} ${u.row.bed} ${u.patient.中文姓名} (id=${u.patient.院友id})`);
  if (u.addA.length) console.log(`    藥物敏感新增: ${u.addA.join(' | ')}`);
  if (u.addR.length) console.log(`    不良反應新增: ${u.addR.join(' | ')}`);
}

if (APPLY) {
  let ok = 0, fail = 0;
  for (const u of updates) {
    try {
      await sql(`UPDATE "院友主表" SET "藥物敏感" = ${toJsonbLiteral(u.mergedA)}, "不良藥物反應" = ${toJsonbLiteral(u.mergedR)} WHERE "院友id" = ${u.patient.院友id}`);
      ok++;
    } catch (e) {
      console.error(`❌ ${u.patient.中文姓名}:`, e.message);
      fail++;
    }
  }
  console.log(`\n完成：成功 ${ok}，失敗 ${fail}`);
} else {
  console.log('\n（dry-run，未寫入；加 --apply 先會真正更新）');
}
