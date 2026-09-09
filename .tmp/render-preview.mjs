import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import fs from 'fs';

const data = new Uint8Array(fs.readFileSync('upload/rvp202627_consent_form_acroform_preview.pdf'));
const doc = await pdfjs.getDocument({ data }).promise;
for (const p of [0, 1, 2, 3]) {
  const page = await doc.getPage(p + 1);
  const vp = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(vp.width, vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, vp.width, vp.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  fs.writeFileSync(`.tmp/preview-p${p + 1}.png`, canvas.toBuffer('image/png'));
  console.log('rendered page', p + 1);
}
