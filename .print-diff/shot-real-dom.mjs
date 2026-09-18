// 完整重現真實 app 非雙面路徑：真 DOM 入面行 padOddPageDocuments（logo 轉換），再出 PDF 驗證
import { chromium } from 'playwright-core';
import { createRequire } from 'module';
import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

// 1. 把 printUtils 編成 IIFE（連 cssScope），注入頁面用
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

// 2. 攞原文件嘅 pageConfig（padOddPageDocuments 需要）
const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-non_duplex_health_record.html';
const combined = fs.readFileSync(htmlPath, 'utf8');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });

// 3. 注入 printUtils 並執行 padOddPageDocuments（非雙面：false）
await page.addScriptTag({ content: iife });
const report = await page.evaluate(() => {
  const wrapper = document.querySelector('[class*="print-doc-"]');
  const cls = wrapper?.className?.split(/\s+/).find(c => c.startsWith('print-doc-'));
  // 由 wrapper style 攞 margin（named page 喺 css 入面，用已知值：2mm 6.35mm 5mm 0）
  const config = { size: 'A4', orientation: 'portrait', margin: '2mm 6.35mm 5mm 0' };
  const before = {
    wrapperClass: cls,
    fixedLogos: document.querySelectorAll('img.admission-page-logo').length,
    fixedPunch: document.querySelectorAll('.punch-guide-fixed').length,
    bodyHeight: document.body.scrollHeight,
  };
  window.PrintUtils.padOddPageDocuments(document, [{ selector: '.' + cls, config }], '', false);
  const after = {
    fixedLogos: document.querySelectorAll('img.admission-page-logo').length,
    absoluteLogos: document.querySelectorAll('img.admission-page-logo[style*="absolute"]').length,
    fixedPunch: document.querySelectorAll('.punch-guide-fixed').length,
    bodyHeight: document.body.scrollHeight,
    wrapperChildren: document.querySelectorAll('.' + cls + ' > img.admission-page-logo').length,
  };
  return { before, after };
});
console.log(JSON.stringify(report, null, 2));

const pdfPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-real-dom.pdf';
await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
await browser.close();

// 4. PDF 轉 PNG
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;
console.log('pdf pages:', doc.numPages);
for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
  const p = await doc.getPage(i);
  const viewport = p.getViewport({ scale: 1.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await p.render({ canvas, canvasContext: canvas, viewport }).promise;
  const out = `C:/Users/Admin/Desktop/care-suite/.print-diff/harness-realdom-page-${i}.png`;
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log('page', i, '->', out);
}
