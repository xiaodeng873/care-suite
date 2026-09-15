// debug：合併後每頁嘅文字內容同 h1 位置，睇邊份文件喺邊頁
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
  },
};
const pt2mm = (pt) => (pt * 25.4) / 72;
const stripPageBlocks = (css) => css.replace(/@page[^{]*\{[^}]*\}/g, '');
const scopeDoc = (html, cls, wrapperStyle) => {
  const styles = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [])
    .map((s) => s.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/i, (m, a, c, b) => a + stripPageBlocks(c) + b)).join('\n');
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? html;
  return { styles, body: `<div class="${cls}" style="${wrapperStyle}">${body}</div>` };
};
(async () => {
  const logoResult = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const logoMod = { exports: {} };
  new Function('module', 'exports', 'require', logoResult.outputFiles[0].text)(logoMod, logoMod.exports, require);
  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const logoSrc = `data:image/png;base64,${pngB64}`;
  const docs = [
    { file: '院友護理評估記錄.html', topMm: 1.1 },
    { file: '院友體溫記錄.html', topMm: 0.8 },
    { file: '院友外出同意書.html', topMm: 7.2 },
  ].map((d) => logoMod.exports.injectPageLogoAbsolute(
    fs.readFileSync(path.join(root, 'upload/doc_html', d.file), 'utf8'), logoSrc, d.topMm));
  const parts = docs.map((d, i) => scopeDoc(d, `print-doc-0-${i}`, `page: pg-0-0;position:relative;`));
  const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
html, body { margin: 0; padding: 0; }
[class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
@page { size: A4; margin: 0; }
@page pg-0-0 { size: A4; margin: 5mm; }
</style>${parts.map((p) => p.styles).join('\n')}</head><body>
${parts.map((p) => p.body).join('\n')}</body></html>`;
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(combined, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  console.log('pages=', doc.numPages);
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const texts = tc.items.map((it) => it.str).filter((s) => s && s.trim()).slice(0, 6);
    console.log(`page ${p}:`, texts.join(' | '));
  }
})().catch((e) => { console.error(e); process.exit(1); });
