import { parse } from '@fast-csv/parse';
import fs from 'fs';
import path from 'path';

const CSV_REGIME = 'C:/Users/Admin/Desktop/care-suite/regime - Sheet1.csv';
const CSV_C = 'C:/Users/Admin/Desktop/care-suite/upload/院友個人基本資料(C).csv';
const CSV_D = 'C:/Users/Admin/Desktop/care-suite/upload/院友個人基本資料(D).csv';

function normalizeName(name) {
  return (name || '').toString().trim().replace(/\s+/g, ' ');
}

function normalizeBed(bed) {
  return (bed || '').toString().trim();
}

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = fs.createReadStream(filePath);
    const parser = parse({ headers: true, trim: true, ignoreEmpty: true });
    stream
      .pipe(parser)
      .on('error', reject)
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows));
  });
}

function findByName(name, patients) {
  const n = normalizeName(name);
  return patients.filter(p => normalizeName(p.中文姓名) === n);
}

async function main() {
  const [regimeRows, cPatients, dPatients] = await Promise.all([
    parseCsv(CSV_REGIME),
    parseCsv(CSV_C),
    parseCsv(CSV_D),
  ]);

  const cMap = new Map(cPatients.map(p => [normalizeBed(p.床位號), p]));
  const dMap = new Map(dPatients.map(p => [normalizeBed(p.床位號), p]));

  const mismatches = [];
  const notFound = [];
  const matched = [];

  for (const row of regimeRows) {
    const bed = normalizeBed(row['床號']);
    const name = normalizeName(row['院友姓名']);
    if (!bed || !name) continue;

    const m = bed.match(/^(\d{3})-(\d+)$/);
    if (!m) continue;
    const room = parseInt(m[1], 10);
    if (room < 202 || room > 287) continue;

    const isC = room >= 202 && room <= 237;
    const isD = room >= 238 && room <= 287;
    const map = isC ? cMap : dMap;
    const allPatients = isC ? cPatients : dPatients;
    const area = isC ? 'C' : 'D';

    const actualPatient = map.get(bed);
    if (!actualPatient) {
      mismatches.push({ csvBed: bed, csvName: name, actualBed: '(空床/無資料)', actualName: '', area, reason: '床位無人' });
      continue;
    }

    if (normalizeName(actualPatient.中文姓名) === name) {
      matched.push({ bed, name, area });
      continue;
    }

    // 姓名不符：在 C/D 區找該姓名實際床位
    const sameName = findByName(name, allPatients);
    if (sameName.length === 1) {
      mismatches.push({
        csvBed: bed,
        csvName: name,
        actualBed: sameName[0].床位號,
        actualName: sameName[0].中文姓名,
        area,
        reason: '姓名/床位錯配'
      });
    } else if (sameName.length > 1) {
      mismatches.push({
        csvBed: bed,
        csvName: name,
        actualBed: sameName.map(p => p.床位號).join(', '),
        actualName: sameName.map(p => p.中文姓名).join(', '),
        area,
        reason: '同名多人'
      });
    } else {
      mismatches.push({
        csvBed: bed,
        csvName: name,
        actualBed: '(找不到)',
        actualName: '',
        area,
        reason: '該區無此人'
      });
    }
  }

  // 按床位分組統計
  const bedGroups = {};
  for (const r of mismatches) {
    const key = `${r.csvBed} ${r.csvName}`;
    bedGroups[key] = bedGroups[key] || { ...r, count: 0 };
    bedGroups[key].count++;
  }

  console.log('=== 錯配報告 ===\n');
  console.log(`CSV 處方總列數（202-287 範圍）：${matched.length + Object.keys(bedGroups).length} 組`);
  console.log(`匹配：${matched.length} 組`);
  console.log(`錯配 / 找不到：${Object.keys(bedGroups).length} 組\n`);

  console.log('錯配 / 找不到清單：\n');
  console.log('| CSV 床位 | CSV 姓名 | 區域 | 實際床位 | 實際姓名 | 原因 | 處方筆數 |');
  console.log('|---|---|---|---|---|---|---|');
  for (const key of Object.keys(bedGroups).sort()) {
    const r = bedGroups[key];
    console.log(`| ${r.csvBed} | ${r.csvName} | ${r.area} | ${r.actualBed} | ${r.actualName} | ${r.reason} | ${r.count} |`);
  }

  // 寫入報告檔案
  const reportPath = path.join(process.cwd(), 'scripts', 'mismatch_report.md');
  const lines = [
    '# CSV 處方與最新院友床位錯配報告',
    '',
    `產生時間：${new Date().toISOString()}`,
    '',
    `- CSV 處方總列數（202-287 範圍）：${matched.length + Object.keys(bedGroups).length} 組`,
    `- 匹配：${matched.length} 組`,
    `- 錯配 / 找不到：${Object.keys(bedGroups).length} 組`,
    '',
    '| CSV 床位 | CSV 姓名 | 區域 | 實際床位 | 實際姓名 | 原因 | 處方筆數 |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const key of Object.keys(bedGroups).sort()) {
    const r = bedGroups[key];
    lines.push(`| ${r.csvBed} | ${r.csvName} | ${r.area} | ${r.actualBed} | ${r.actualName} | ${r.reason} | ${r.count} |`);
  }
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`\n報告已寫入：${reportPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
