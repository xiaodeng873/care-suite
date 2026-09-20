import ExcelJS from '@zurmokeeper/exceljs';
for (const f of ['upload/院友藥物反應設置管理報表 (C).xlsx', 'upload/院友藥物反應設置管理報表(D).xlsx']) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(f);
  console.log('=== FILE:', f);
  wb.eachSheet((ws) => {
    console.log('--- sheet:', ws.name, 'rows:', ws.rowCount);
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n <= 10) console.log(n, JSON.stringify(row.values));
    });
  });
}
