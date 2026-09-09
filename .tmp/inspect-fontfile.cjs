const { PDFDocument, PDFName } = require('pdf-lib');
const fs = require('node:fs');
async function checkFontFile(path, label) {
  const doc = await PDFDocument.load(fs.readFileSync(path));
  const page = doc.getPage(0);
  const fonts = page.node.get(PDFName.of('Resources'))?.get(PDFName.of('Font'));
  if (!fonts) { console.log(label, ': no font resources'); return; }
  for (const k of fonts.keys()) {
    const name = k.toString();
    if (!name.includes('DFKaiShu') && !name.includes('Helvetica')) continue;
    const f = doc.context.lookup(fonts.get(k));
    let info = `${label} ${name}: subtype=${f.get(PDFName.of('Subtype'))}`;
    let descRef = f.get(PDFName.of('FontDescriptor'));
    if (!descRef) {
      const descArr = f.get(PDFName.of('DescendantFonts'));
      if (descArr) {
        const cid = doc.context.lookup(descArr.get(0));
        descRef = cid?.get?.(PDFName.of('FontDescriptor'));
        info += ` (via CIDFont ${cid?.get?.(PDFName.of('BaseFont'))})`;
      }
    }
    if (descRef) {
      const desc = doc.context.lookup(descRef);
      const ff2 = desc.get(PDFName.of('FontFile2'));
      const ff3 = desc.get(PDFName.of('FontFile3'));
      info += ` FontFile2=${ff2 ? 'YES' : 'NO'} FontFile3=${ff3 ? 'YES' : 'NO'}`;
    } else {
      info += ' NO DESCRIPTOR AT ALL';
    }
    console.log(info);
  }
}
(async () => {
  await checkFontFile('.tmp/consent-test-filled.pdf', '[單人WORKING]');
  await checkFontFile('.tmp/copied-draw-test.pdf', '[合併BROKEN]');
})();
