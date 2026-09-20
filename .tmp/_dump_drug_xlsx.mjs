import ExcelJS from '@zurmokeeper/exceljs';
const files = [
  ['C', 'upload/院友藥物反應設置管理報表 (C).xlsx'],
  ['D', 'upload/院友藥物反應設置管理報表(D).xlsx'],
];
const allergyVals = new Set(); const adrVals = new Set();
for (const [station, f] of files) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(f);
  const ws = wb.worksheets[0];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= 4) return;
    const v = row.values;
    const bed = String(v[1] ?? '').trim();
    const name = String(v[4] ?? '').trim();
    const allergy = String(v[5] ?? '').trim();
    const adr = String(v[6] ?? '').trim();
    if (allergy) allergyVals.add(allergy);
    if (adr) adrVals.add(adr);
    if (allergy || adr) console.log(`${station} | ${bed} | ${name} | A=${allergy} | R=${adr}`);
  });
}
console.log('\n=== distinct allergy values:', allergyVals.size);
console.log('\n=== distinct adr values:', adrVals.size);
