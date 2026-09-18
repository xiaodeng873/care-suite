import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');
const data = new Uint8Array(fs.readFileSync('C:/Users/Admin/Desktop/care-suite/.print-diff/final-nonduplex.pdf'));
const doc = await pdfjs.getDocument({ data }).promise;
console.log('pages:', doc.numPages);
for (const i of [2, 7, 8]) {
  const p = await doc.getPage(i);
  const vp = p.getViewport({ scale: 1.5 });
  const canvas = createCanvas(vp.width, vp.height);
  await p.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  fs.writeFileSync(`C:/Users/Admin/Desktop/care-suite/.print-diff/nd2-p${i}.png`, canvas.toBuffer('image/png'));
}
console.log('done');
