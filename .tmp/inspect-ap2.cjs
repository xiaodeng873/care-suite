const { PDFDocument, PDFName } = require('pdf-lib');
const fs = require('node:fs');
(async () => {
  const doc = await PDFDocument.load(fs.readFileSync('apps/web/public/rvp202627_consent_form_acroform.pdf'));
  const page = doc.getPage(0);
  const annots = page.node.get(PDFName.of('Annots')).asArray();
  for (const ref of annots.slice(0, 1)) {
    const a = doc.context.lookup(ref);
    console.log('annot keys:', a.keys().map(k => k.toString()));
    console.log('T =', a.get(PDFName.of('T'))?.toString(), 'Subtype =', a.get(PDFName.of('Subtype'))?.toString());
    const ap = doc.context.lookup(a.get(PDFName.of('AP')));
    console.log('AP dict keys:', ap.keys().map(k => k.toString()));
    const nRef = ap.get(PDFName.of('N'));
    const n = doc.context.lookup(nRef);
    console.log('AP/N stream dict keys:', (n.dict ?? n).keys().map(k => k.toString()));
    const res = (n.dict ?? n).get(PDFName.of('Resources'));
    if (res) {
      const r = doc.context.lookup(res);
      console.log('AP resources:', r.toString().slice(0, 300));
    } else {
      console.log('AP/N has NO own Resources');
      // 咁 Helvetica 去邊度？ 睇 widget 頂層 Resources
      const ares = a.get(PDFName.of('Resources'));
      console.log('annot-level Resources:', ares ? doc.context.lookup(ares)?.toString().slice(0, 300) : '(none)');
    }
  }
})();
