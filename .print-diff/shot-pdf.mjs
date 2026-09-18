// 用真分页 (page.pdf) 出 PDF，再用 pdfjs + napi-canvas 轉 PNG
import { chromium } from 'playwright-core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-non_duplex_health_record.html';
const pdfPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-non_duplex_health_record.pdf';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log('pdf saved');

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;
console.log('pdf pages:', doc.numPages);
for (let i = 1; i <= doc.numPages; i++) {
  const p = await doc.getPage(i);
  const viewport = p.getViewport({ scale: 1.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await p.render({ canvas, canvasContext: canvas, viewport }).promise;
  const out = `C:/Users/Admin/Desktop/care-suite/.print-diff/harness-pdf-page-${i}.png`;
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log('page', i, '->', out, viewport.width, 'x', viewport.height);
}
