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

const runWithRuleSubset = async (idxs) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const culprit = await page.evaluate((idxs) => {
    document.querySelectorAll('[class*="print-doc-"]').forEach((w) => {
      if (w.className !== 'print-doc-0-2') w.remove();
    });
    let gi = 0;
    const culprit = [];
    for (const st of document.querySelectorAll('style')) {
      const css = st.textContent || '';
      if (!css.includes('.print-doc-0-2')) continue;
      const rules = css.split('}').filter((r) => r.trim());
      const keep = new Set(idxs);
      const out = [];
      rules.forEach((r) => {
        if (keep.has(gi)) out.push(r + '}');
        else culprit.push(r.trim() + '}');
        gi++;
      });
      st.textContent = out.join('');
    }
    return culprit;
  }, idxs);
  const pdfPath = `C:/Users/Admin/Desktop/care-suite/.print-diff/bisect4.pdf`;
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  return { res: await measure(pdfPath), culprit };
};

const isBad = (res) => JSON.stringify(res) !== JSON.stringify([108.7, 188.7]) && !(res.length === 2 && Math.abs(res[0]-108.7)<1 && Math.abs(res[1]-188.7)<1);

// 二分搜：47 條 rules
let lo = 0, hi = 47; // 嫌疑集合 = [lo, 47)
// 策略：keep = 全部; 若壞，逐半移除
let candidates = Array.from({ length: 47 }, (_, i) => i);
while (candidates.length > 1) {
  const half = candidates.slice(0, Math.ceil(candidates.length / 2));
  const keep = Array.from({ length: 47 }, (_, i) => i).filter((i) => !half.includes(i));
  const { res } = await runWithRuleSubset(keep);
  if (isBad(res)) {
    // 移除咗 half 仍然壞 → 元兇喺剩下嗰半
    candidates = candidates.filter((i) => !half.includes(i));
  } else {
    candidates = half;
  }
  console.log('candidates:', candidates.length, 'last res:', JSON.stringify(res));
}
const { res, culprit } = await runWithRuleSubset(Array.from({ length: 47 }, (_, i) => i).filter((i) => i !== candidates[0]));
console.log('FINAL culprit rule:', culprit.join('\n'));
console.log('without it:', JSON.stringify(res));
