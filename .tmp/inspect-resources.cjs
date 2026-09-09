const { PDFDocument, PDFName } = require('pdf-lib');
const fs = require('node:fs');
(async () => {
  const doc = await PDFDocument.load(fs.readFileSync('.tmp/copied-draw-test.pdf'));
  const page = doc.getPage(0);
  const res = page.node.get(PDFName.of('Resources'));
  const fonts = res?.get(PDFName.of('Font'));
  console.log('Resources keys:', res?.keys?.().map(k => k.toString()));
  console.log('Font dict entries:', fonts ? fonts.keys().map(k => k.toString()) : '(none)');
  // 逐個 font 睇有冇 FontFile
  if (fonts) {
    for (const k of fonts.keys()) {
      const f = doc.context.lookup(fonts.get(k));
      const subtype = f.get(PDFName.of('Subtype'))?.toString();
      const baseFont = f.get(PDFName.of('BaseFont'))?.toString();
      const descRef = f.get(PDFName.of('FontDescriptor'));
      let hasFile = 'n/a';
      if (descRef) {
        const desc = doc.context.lookup(descRef);
        hasFile = String(!!desc.get(PDFName.of('FontFile2')) || !!desc.get(PDFName.of('FontFile3')));
      }
      console.log(` ${k.toString()}: subtype=${subtype} baseFont=${baseFont} hasFontFile=${hasFile}`);
    }
  }
  // 全文件入面嘅 font 物件
  console.log('---all font objects in doc---');
  doc.context.enumerateIndirectObjects?.().forEach?.(([ref, obj]) => {});
})();
