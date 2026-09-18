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

const runWithRuleSubset = async (ruleIdxs) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const info = await page.evaluate((idxs) => {
    // 只留 financial proxy wrapper
    document.querySelectorAll('[class*="print-doc-"]').forEach((w) => {
      if (w.className !== 'print-doc-0-2') w.remove();
    });
    // 搵包含 .print-doc-0-2 嘅 style，逐條 rule 控制
    let total = 0;
    for (const st of document.querySelectorAll('style')) {
      const css = st.textContent || '';
      if (!css.includes('.print-doc-0-2')) continue;
      const rules = css.split('}').filter((r) => r.trim());
      total += rules.length;
      if (idxs === null) continue; // keep all
      const keep = new Set(idxs);
      let gi = 0;
      const out = rules.filter((r) => keep.has(gi++));
      st.textContent = out.map((r) => r + '}').join('');
    }
    return total;
  }, ruleIdxs);
  const pdfPath = `C:/Users/Admin/Desktop/care-suite/.print-diff/bisect3.pdf`;
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  const res = await measure(pdfPath);
  return { info, res };
};

// 全部 rules 嘅 baseline
const base = await runWithRuleSubset(null);
console.log('all rules:', JSON.stringify(base));
