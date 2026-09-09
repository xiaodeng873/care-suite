import fs from 'node:fs';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync('.tmp/consent-browser-test.pdf')) }).promise;
let t = '';
for (let i = 1; i <= doc.numPages; i++) {
  const tc = await (await doc.getPage(i)).getTextContent();
  t += tc.items.map(x => x.str).join(' ') + '\n';
}
console.log('pages:', doc.numPages);
for (const s of ['張', '行濤', '郭', '耀']) console.log(s, '→', t.includes(s) ? 'OK' : 'MISSING');
