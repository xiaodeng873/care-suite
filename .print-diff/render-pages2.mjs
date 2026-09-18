import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');
const data = new Uint8Array(fs.readFileSync('C:/Users/Admin/Desktop/care-suite/.print-diff/final-duplex.pdf'));
const doc = await pdfjs.getDocument({ data }).promise;
for (const i of [2, 11, 12, 13, 15]) {
  const p = await doc.getPage(i);
  const vp = p.getViewport({ scale: 1.5 });
  const canvas = createCanvas(vp.width, vp.height);
  await p.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  fs.writeFileSync(`C:/Users/Admin/Desktop/care-suite/.print-diff/dx-p${i}.png`, canvas.toBuffer('image/png'));
  console.log('rendered', i);
}
