import fs from 'fs';

const file = 'scripts/import_c_station_prescriptions.mjs';
let s = fs.readFileSync(file, 'utf8');
const start = 'function readCsv(filePath) {';
const idx = s.indexOf(start);
const end = s.indexOf('// ── 通用正規化', idx);
if (idx === -1 || end === -1) {
  console.error('markers not found');
  process.exit(1);
}
const replacement = `function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('找不到 CSV：' + filePath);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return parseCsv(stripBOM(raw));
}

`;
s = s.slice(0, idx) + replacement + s.slice(end);
fs.writeFileSync(file, s);
console.log('fixed');
