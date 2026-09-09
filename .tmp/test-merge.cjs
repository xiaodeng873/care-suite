const { PDFDocument } = require('pdf-lib');
const fs = require('node:fs');
(async () => {
  // 用之前 browser smoke test 產生嘅已填表 PDF（有 flatten 中文）
  const src = fs.readFileSync('.tmp/consent-browser-test.pdf');
  const single = await PDFDocument.load(src);
  const merged = await PDFDocument.create();
  const doc = await PDFDocument.load(src);
  const copied = await merged.copyPages(doc, doc.getPageIndices());
  copied.forEach(p => merged.addPage(p));
  const out = new Uint8Array(await merged.save());
  fs.writeFileSync('.tmp/merged-test.pdf', out);
  console.log('single bytes:', src.length, 'merged bytes:', out.length);
})();
