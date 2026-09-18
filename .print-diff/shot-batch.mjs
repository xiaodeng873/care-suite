// 批次重現：真 DOM 行 padOddPageDocuments（非雙面 false，同用戶操作一致），出 PDF → PNG
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
  bundle: true, write: false, format: 'iife', globalName: 'PrintUtils',
  platform: 'browser',
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
const combined = fs.readFileSync(htmlPath, 'utf8');
const configs = JSON.parse(fs.readFileSync('C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-configs.json', 'utf8'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });

await page.addScriptTag({ content: iife });
const report = await page.evaluate((configs) => {
  // 由 baseCss 攞 named page rules：pageName -> margin
  const pageRuleRe = /@page (pg-\d+-\d+) \{[^}]*margin: ([^;}]+)/g;
  const margins = {};
  for (const st of Array.from(document.querySelectorAll('style'))) {
    const css = st.textContent || '';
    let m;
    while ((m = pageRuleRe.exec(css))) margins[m[1]] = m[2].trim();
  }
  const wrappers = Array.from(document.querySelectorAll('[class*="print-doc-"]'))
    .filter((el) => /^print-doc-\d+-\d+$/.test(el.className));
  const list = wrappers.map((w, i) => {
    const pageName = (w.getAttribute('style') || '').match(/page:\s*(pg-\d+-\d+)/)?.[1];
    const margin = margins[pageName] || '0 0 0 0';
    return { selector: '.' + w.className, config: { size: 'A4', orientation: 'portrait', margin }, pageName };
  });
  const before = {
    wrapperCount: wrappers.length,
    fixedPunch: document.querySelectorAll('.punch-guide-fixed').length,
    fixedLogos: document.querySelectorAll('img.admission-page-logo').length,
    rules: list,
  };
  window.PrintUtils.padOddPageDocuments(document, list, '', false);
  const after = {
    fixedPunch: document.querySelectorAll('.punch-guide-fixed').length,
    fixedLogos: document.querySelectorAll('img.admission-page-logo').length,
    absLogos: document.querySelectorAll('img.admission-page-logo[style*="absolute"]').length,
    bodyHeight: document.body.scrollHeight,
  };
  return { before, after, configs };
}, configs);
console.log(JSON.stringify(report.before, null, 2));
console.log(JSON.stringify(report.after, null, 2));

const pdfPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch.pdf';
await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
await browser.close();

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;
console.log('pdf pages:', doc.numPages);
for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
  const p = await doc.getPage(i);
  const viewport = p.getViewport({ scale: 1.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await p.render({ canvas, canvasContext: canvas, viewport }).promise;
  const out = `C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-page-${i}.png`;
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log('page', i, '->', out);
}
