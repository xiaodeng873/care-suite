import { chromium } from 'playwright-core';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const circles = `.g{position:fixed;left:12mm;top:105.5mm;width:6mm;height:6mm;border:0.35mm dashed #999;border-radius:50%;}
.g2{position:fixed;left:12mm;top:185.5mm;width:6mm;height:6mm;border:0.35mm dashed #999;border-radius:50%;}`;
const a4 = (n, extra = '') => `<div class="doc-page-${n}" style="width:210mm;height:297mm;position:relative;${extra}">頁${n}</div>`;

const variants = {
  m1_onepage: `<style>@page{size:A4;margin:0}@page pg{size:A4 portrait;margin:0 0 0 0}.w{page:pg}${circles}</style><body><div class="w"><div class="g"></div><div class="g2"></div>${a4(0)}</body>`,
  m2_twopage: `<style>@page{size:A4;margin:0}@page pg{size:A4 portrait;margin:0 0 0 0}.w{page:pg}.doc-page-0+.doc-page-1{break-before:page}${circles}</style><body><div class="w"><div class="g"></div><div class="g2"></div>${a4(0)}${a4(1)}</body>`,
  m3_twopage_250: `<style>@page{size:A4;margin:0}@page pg{size:A4 portrait;margin:0 0 0 0}.w{page:pg}.doc-page-0+.doc-page-1{break-before:page}${circles}</style><body><div class="w"><div class="g"></div><div class="g2"></div>${a4(0, 'height:250mm')}${a4(1)}</body>`,
};

const measure = async (pdfPath, pageNo = 1) => {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  if (pageNo > doc.numPages) return null;
  const p = await doc.getPage(pageNo);
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
  const segs = []; let s = null, prev = null;
  for (const y of rows) { if (s===null) s=y; else if (y-prev>15){segs.push([s,prev]);s=y;} prev=y; }
  if (s!==null) segs.push([s,prev]);
  return segs.filter(([a,b]) => (b-a) > 3*pxPerMm).map(([a,b]) => +((a+b)/2/pxPerMm).toFixed(1));
};

for (const [name, body] of Object.entries(variants)) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(`<!DOCTYPE html><html><head>${body.split('</style>')[0]}</style></head>${body.split('</style>')[1]}`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const pdfPath = `C:/Users/Admin/Desktop/care-suite/.print-diff/micro2-${name}.pdf`;
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log(name, 'p1:', JSON.stringify(await measure(pdfPath, 1)), 'p2:', JSON.stringify(await measure(pdfPath, 2)));
}
