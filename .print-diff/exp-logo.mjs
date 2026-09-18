// 實驗：logo clone 定位策略矩陣
import { chromium } from 'playwright-core';
import { createRequire } from 'module';
import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const stubDir = path.join(root, '.print-diff/stubs');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'apps/web/src/utils/printUtils.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'PrintUtils', platform: 'browser',
  plugins: [{
    name: 'stubs',
    setup(build) {
      build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
      build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
      build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    },
  }],
});
const iife = result.outputFiles[0].text;
const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');

const findImages = async (pdfPath, doc_) => {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const d = await pdfjs.getDocument({ data }).promise;
  const out = [];
  const toMm = (pt) => +(pt / 72 * 25.4).toFixed(1);
  for (let i = 1; i <= d.numPages; i++) {
    const p = await d.getPage(i);
    const ops = await p.getOperatorList();
    let cur = [1,0,0,1,0,0]; const stack = [];
    const mul = (m1,m2) => [m1[0]*m2[0]+m1[2]*m2[1], m1[1]*m2[0]+m1[3]*m2[1], m1[0]*m2[2]+m1[2]*m2[3], m1[1]*m2[2]+m1[3]*m2[3], m1[0]*m2[4]+m1[2]*m2[5]+m1[4], m1[1]*m2[4]+m1[3]*m2[5]+m1[5]];
    for (let j = 0; j < ops.fnArray.length; j++) {
      const fn = ops.fnArray[j], args = ops.argsArray[j];
      if (fn === pdfjs.OPS.save) stack.push(cur);
      else if (fn === pdfjs.OPS.restore) cur = stack.pop() || [1,0,0,1,0,0];
      else if (fn === pdfjs.OPS.transform) cur = mul(cur, args);
      else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject)
        out.push({ page: i, x: toMm(cur[4]), yTop: toMm(p.view[3] - cur[5]) });
    }
  }
  return out;
};

const runVariant = async (name, tweak) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.addScriptTag({ content: iife });
  const placements = await page.evaluate((tweakName) => {
    const pageRuleRe = /@page (pg-\d+-\d+) \{[^}]*margin: ([^;}]+)/g;
    const margins = {};
    for (const st of Array.from(document.querySelectorAll('style'))) {
      const css = st.textContent || '';
      let m;
      while ((m = pageRuleRe.exec(css))) margins[m[1]] = m[2].trim();
    }
    const wrappers = Array.from(document.querySelectorAll('[class*="print-doc-"]')).filter((el) => /^print-doc-\d+-\d+$/.test(el.className));
    const list = wrappers.map((w) => {
      const pageName = (w.getAttribute('style') || '').match(/page:\s*(pg-\d+-\d+)/)?.[1];
      return { selector: '.' + w.className, config: { size: 'A4', orientation: 'portrait', margin: margins[pageName] || '0 0 0 0' }, pageName };
    });
    window.PrintUtils.padOddPageDocuments(document, list, '', false);
    if (tweakName === 'offset10') {
      // k>=1 clones：top 由 k*H+0.3 改做 k*H+10
      document.querySelectorAll('img.admission-page-logo').forEach((img) => {
        const t = parseFloat(img.style.top);
        if (t > 200) img.style.top = (t + 9.7).toFixed(1) + 'mm';
      });
    }
    return true;
  }, tweak);
  const pdfPath = `C:/Users/Admin/Desktop/care-suite/.print-diff/exp-${name}.pdf`;
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  const imgs = await findImages(pdfPath);
  console.log(name, JSON.stringify(imgs));
};

await runVariant('baseline', 'none');
await runVariant('offset10', 'offset10');
