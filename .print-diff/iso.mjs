import { chromium } from 'playwright-core';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';

const measure = async (pdfPath) => {
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
  const segs = []; let s = null, prev = null;
  for (const y of rows) { if (s===null) s=y; else if (y-prev>15){segs.push([s,prev]);s=y;} prev=y; }
  if (s!==null) segs.push([s,prev]);
  return segs.filter(([a,b]) => (b-a) > 3*pxPerMm).map(([a,b]) => +((a+b)/2/pxPerMm).toFixed(1));
};

const run = async (name, fn) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(fn);
  const pdfPath = `C:/Users/Admin/Desktop/care-suite/.print-diff/iso-${name}.pdf`;
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log(name, 'circles:', JSON.stringify(await measure(pdfPath)));
};

// A. 只留 financial proxy wrapper，但清空入面所有內容（留 circles + logo + styles）
await run('no-content', () => {
  document.querySelectorAll('[class*="print-doc-"]').forEach((w) => {
    if (w.className !== 'print-doc-0-2') { w.remove(); return; }
    Array.from(w.children).forEach((c) => {
      if (!c.classList.contains('punch-guide-fixed') && !(c.tagName === 'IMG')) c.remove();
    });
  });
});

// B. 喺 A 基礎上，連 style 都刪（除 baseCss 同 punch/logo scoped 規則）
await run('no-content-no-style', () => {
  document.querySelectorAll('[class*="print-doc-"]').forEach((w) => {
    if (w.className !== 'print-doc-0-2') { w.remove(); return; }
    Array.from(w.children).forEach((c) => {
      if (!c.classList.contains('punch-guide-fixed') && !(c.tagName === 'IMG')) c.remove();
    });
  });
  document.querySelectorAll('style').forEach((st) => {
    const css = st.textContent || '';
    if (css.includes('.print-doc-0-2') && !css.includes('punch-guide-fixed') && !css.includes('admission-page-logo')) st.remove();
  });
});
