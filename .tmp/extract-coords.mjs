import fs from 'node:fs';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync('.tmp/copied-draw-test.pdf')) }).promise;
const page = await doc.getPage(1);
const tc = await page.getTextContent();
for (const it of tc.items) {
  if (['張', 'CHEUNG'].includes(it.str)) console.log(JSON.stringify(it.str), 'transform:', it.transform.map(n => Math.round(n)));
}
console.log('page vp:', (await page.getViewport({ scale: 1 })).width, 'x', (await page.getViewport({ scale: 1 })).height);
