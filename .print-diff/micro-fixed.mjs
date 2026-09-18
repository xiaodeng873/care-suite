import { chromium } from 'playwright-core';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const variants = {
  // 1. 裸 @page margin 0，fixed top:105.5mm
  bare: `<!DOCTYPE html><html><head><style>
    @page { size: A4; margin: 0; }
    .g { position: fixed; left: 12mm; top: 105.5mm; width: 6mm; height: 6mm; border: 0.35mm dashed #999; border-radius: 50%; }
    .g2 { position: fixed; left: 12mm; top: 185.5mm; width: 6mm; height: 6mm; border: 0.35mm dashed #999; border-radius: 50%; }
    </style></head><body><div class="g"></div><div class="g2"></div></body></html>`,
  // 2. named page margin 0 0 5mm 0（模擬批次）
  named: `<!DOCTYPE html><html><head><style>
    @page { size: A4; margin: 0; }
    @page pg { size: A4 portrait; margin: 0mm 0mm 5mm 0; }
    .w { page: pg; }
    .g { position: fixed; left: 12mm; top: 105.5mm; width: 6mm; height: 6mm; border: 0.35mm dashed #999; border-radius: 50%; }
    .g2 { position: fixed; left: 12mm; top: 185.5mm; width: 6mm; height: 6mm; border: 0.35mm dashed #999; border-radius: 50%; }
    </style></head><body><div class="w"><div class="g"></div><div class="g2"></div><p style="height:200mm">x</p></div></body></html>`,
};

for (const [name, html] of Object.entries(variants)) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const pdfPath = `C:/Users/Admin/Desktop/care-suite/.print-diff/micro-${name}.pdf`;
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const p = await doc.getPage(1);
  const vp = p.getViewport({ scale: 4 });
  const canvas = createCanvas(vp.width, vp.height);
  await p.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  const ctx = canvas.getContext('2d');
  const pxPerMm = vp.height / 297;
  const rows = [];
  for (let y = 0; y < canvas.height; y++) {
    const row = ctx.getImageData(Math.round(9*pxPerMm), y, Math.round(11*pxPerMm), 1).data;
    let gray = 0;
    for (let x = 0; x < row.length; x += 4) {
      const r = row[x], g = row[x+1], b = row[x+2];
      if (Math.abs(r-g)<10 && Math.abs(g-b)<10 && r>130 && r<180) gray++;
    }
    if (gray >= 2) rows.push(y);
  }
  const segs = [];
  let s = null, prev = null;
  for (const y of rows) { if (s===null) s=y; else if (y-prev>15){segs.push([s,prev]);s=y;} prev=y; }
  if (s!==null) segs.push([s,prev]);
  console.log(name, segs.map(([a,b])=>'center '+((a+b)/2/pxPerMm).toFixed(1)+'mm').join(' | '));
}
