const fs = require('fs');
const { PDFDocument, PDFName } = require('pdf-lib');

function decodeText(t) {
  try { return t.decodeText(); } catch { return String(t); }
}

(async () => {
  const bytes = fs.readFileSync('.tmp/consent-browser-test.pdf');
  const doc = await PDFDocument.load(bytes);
  const ctx = doc.context;
  const pages = doc.getPages();
  for (let i = 0; i < Math.min(2, pages.length); i++) {
    const annots = pages[i].node.get(PDFName.of('Annots'));
    if (!annots) continue;
    for (const ref of annots.asArray()) {
      const a = ctx.lookup(ref);
      if (!a) continue;
      const parent = a.get(PDFName.of('Parent'));
      const field = parent ? ctx.lookup(parent) : a;
      const t = field?.get?.(PDFName.of('T'));
      if (!t) continue;
      const name = decodeText(t);
      if (!name.includes('sex')) continue;
      console.log(`page ${i} field=${name}`);
      console.log('  FT:', String(field.get(PDFName.of('FT'))));
      const v = field.get(PDFName.of('V'));
      console.log('  V:', v ? String(v) : '(none)');
      console.log('  AS:', a.get(PDFName.of('AS')) ? String(a.get(PDFName.of('AS'))) : '(none)');
      const ap = a.get(PDFName.of('AP'));
      if (ap) {
        const apd = ctx.lookup(ap);
        const n = apd.get(PDFName.of('N'));
        if (!n) { console.log('  AP/N: (none)'); continue; }
        const nd = ctx.lookup(n);
        if (nd && typeof nd.keys === 'function') {
          console.log('  AP/N keys:', nd.keys().map(k => String(k)).join(', '));
          for (const k of nd.keys()) {
            const s = ctx.lookup(nd.get(k));
            if (s && s.contents) {
              const raw = Buffer.from(s.contents).toString('latin1');
              console.log(`    [${String(k)}] ${raw.length} bytes`);
            }
          }
        } else {
          console.log('  AP/N is direct:', n.constructor.name);
        }
      } else {
        console.log('  AP: (none)');
      }
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
