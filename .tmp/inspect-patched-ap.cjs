const { PDFDocument, PDFName } = require('pdf-lib');
const zlib = require('node:zlib');
const fs = require('node:fs');
(async () => {
  const doc = await PDFDocument.load(fs.readFileSync('.tmp/consent-browser-test.pdf'));
  const page = doc.getPage(0);
  const annots = page.node.get(PDFName.of('Annots')).asArray();
  for (const ref of annots) {
    const a = doc.context.lookup(ref);
    const parent = doc.context.lookup(a.get(PDFName.of('Parent')));
    const t = parent?.get(PDFName.of('T'))?.decodeText?.() ?? '';
    if (!t || !t.includes('p1_surname')) continue;
    console.log('field:', t);
    const ap = doc.context.lookup(a.get(PDFName.of('AP')));
    const n = doc.context.lookup(ap.get(PDFName.of('N')));
    const dict = n.dict ?? n;
    console.log('stream keys:', dict.keys().map(k => k.toString()));
    const data = n.contents;
    const f = dict.get(PDFName.of('Filter'));
    let raw = f?.toString?.().includes('Flate') ? zlib.inflateSync(Buffer.from(data)).toString('latin1') : Buffer.from(data).toString('latin1');
    console.log('AP content:', JSON.stringify(raw.slice(0, 400)));
    const res = doc.context.lookup(dict.get(PDFName.of('Resources')));
    console.log('AP resources:', res?.toString());
  }
})();
