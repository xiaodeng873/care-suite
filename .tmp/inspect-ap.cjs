const { PDFDocument, PDFName } = require('pdf-lib');
const zlib = require('node:zlib');
const fs = require('node:fs');
(async () => {
  const doc = await PDFDocument.load(fs.readFileSync('apps/web/public/rvp202627_consent_form_acroform.pdf'));
  const page = doc.getPage(0);
  const annots = page.node.get(PDFName.of('Annots'));
  if (!annots) { console.log('no annots'); return; }
  const list = annots.asArray ? annots.asArray() : [annots];
  console.log('annots:', list.length);
  for (const ref of list.slice(0, 3)) {
    const a = doc.context.lookup(ref);
    const st = a.get(PDFName.of('Subtype'))?.toString();
    const ap = a.get(PDFName.of('AP'));
    console.log('annot subtype:', st, 'has AP:', !!ap);
    if (ap) {
      const n = ap.get(PDFName.of('N'));
      if (n) {
        const s = doc.context.lookup(n);
        const data = s.contents ?? s.getContents?.();
        const dict = s.dict ?? s;
        const f = dict.get(PDFName.of('Filter'));
        let raw = f?.toString?.().includes('Flate') ? zlib.inflateSync(Buffer.from(data)).toString('latin1') : Buffer.from(data).toString('latin1');
        console.log('  AP stream (' + raw.length + 'b):', JSON.stringify(raw.slice(0, 300)));
      }
    }
  }
})();
