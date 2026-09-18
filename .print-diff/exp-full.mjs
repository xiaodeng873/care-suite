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
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: iife });
const before = await page.evaluate(() => {
  const PX_PER_MM = 96 / 25.4;
  const w = document.querySelector('.print-doc-0-4');
  return Array.from(w.querySelectorAll('.container')).map((c) => ({
    offsetTopMm: +(c.offsetTop / PX_PER_MM).toFixed(1),
    hMm: +(c.getBoundingClientRect().height / PX_PER_MM).toFixed(1),
  }));
});
console.log('before:', JSON.stringify(before));
await page.evaluate(() => {
  const margins = {};
  const pageRuleRe = /@page (pg-\d+-\d+) \{[^}]*margin: ([^;}]+)/g;
  for (const st of Array.from(document.querySelectorAll('style'))) {
    const css = st.textContent || '';
    let m;
    while ((m = pageRuleRe.exec(css))) margins[m[1]] = m[2].trim();
  }
  const wrappers = Array.from(document.querySelectorAll('[class*="print-doc-"]'))
    .filter((el) => /^print-doc-\d+-\d+$/.test(el.className));
  const list = wrappers.map((w) => {
    const pageName = (w.getAttribute('style') || '').match(/page:\s*(pg-\d+-\d+)/)?.[1];
    const margin = margins[pageName] || '0 0 0 0';
    const landscape = (w.getAttribute('style') || '').includes('pg-0-2');
    return { selector: '.' + w.className, config: { size: 'A4', orientation: landscape ? 'landscape' : 'portrait', margin }, pageName };
  });
  window.PrintUtils.padOddPageDocuments(document, list, '', true);
});
const after = await page.evaluate(() => {
  const PX_PER_MM = 96 / 25.4;
  const w = document.querySelector('.print-doc-0-4');
  return Array.from(w.querySelectorAll('.container')).map((c) => ({
    offsetTopMm: +(c.offsetTop / PX_PER_MM).toFixed(1),
    hMm: +(c.getBoundingClientRect().height / PX_PER_MM).toFixed(1),
    style: c.getAttribute('style'),
  }));
});
console.log('after:', JSON.stringify(after, null, 1));
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: 'C:/Users/Admin/Desktop/care-suite/.print-diff/exp-full.pdf', preferCSSPageSize: true, printBackground: true });
await browser.close();
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');
const data = new Uint8Array(fs.readFileSync('C:/Users/Admin/Desktop/care-suite/.print-diff/exp-full.pdf'));
const doc = await pdfjs.getDocument({ data }).promise;
console.log('pages:', doc.numPages);
for (let i = 7; i <= Math.min(doc.numPages, 9); i++) {
  const p = await doc.getPage(i);
  const vp = p.getViewport({ scale: 1.2 });
  const canvas = createCanvas(vp.width, vp.height);
  await p.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  fs.writeFileSync(`C:/Users/Admin/Desktop/care-suite/.print-diff/exp-full-p${i}.png`, canvas.toBuffer('image/png'));
}
console.log('rendered 7-9');
