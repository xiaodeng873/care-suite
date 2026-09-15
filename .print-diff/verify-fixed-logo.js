// e2e v4：統一 fixed 右上角 logo —— 合併列印每頁應有 logo，且同頁多個 logo 完全疊合
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
function matMul(m, n) {
  const [a1, b1, c1, d1, e1, f1] = m; const [a2, b2, c2, d2, e2, f2] = n;
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}
const applyM = (m, x, y) => { const [a, b, c, d, e, f] = m; return [a * x + c * y + e, b * x + d * y + f]; };

(async () => {
  const load = async (entry) => {
    const result = await esbuild.build({
      entryPoints: [path.join(root, entry)],
      bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
    });
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
    return mod.exports;
  };
  const { scopeCssText, scopeInlineScripts } = await load('apps/web/src/utils/cssScope.ts');
  const { injectPageLogo } = await load('apps/web/src/utils/printPageLogo.ts');
  const { stripPageBlocks } = await load('apps/web/src/utils/printUtils.ts');
  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const logoSrc = `data:image/png;base64,${pngB64}`;

  const scopeDocumentHtml = (page, scopeClass, wrapperStyle) => {
    const styleMatches = page.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const scopedStyles = styleMatches.map((styleTag) => {
      const openMatch = styleTag.match(/^<style([^>]*)>([\s\S]*?)<\/style>$/i);
      if (!openMatch) return styleTag;
      const [, attrs, innerCss] = openMatch;
      return `<style${attrs}>${scopeCssText(stripPageBlocks(innerCss), scopeClass)}</style>`;
    });
    const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const rawBody = bodyMatch ? bodyMatch[1].trim() : page.trim();
    const bodyContent = scopeInlineScripts(rawBody, scopeClass);
    return {
      styles: scopedStyles.join('\n'),
      body: `<div class="${scopeClass}"${wrapperStyle ? ` style="${wrapperStyle}"` : ''}>${bodyContent}</div>`,
    };
  };

  const docs = ['院友護理評估記錄.html', '院友體溫記錄.html', '院友外出同意書.html']
    .map((f) => injectPageLogo(fs.readFileSync(path.join(root, 'upload/doc_html', f), 'utf8'), logoSrc));

  const parts = docs.map((d, i) => scopeDocumentHtml(d, `print-doc-0-${i}`, 'page: pg-0-0;'));
  const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  @page { size: A4; margin: 0; }
  @page pg-0-0 { size: A4; margin: 5mm; }
</style>
${parts.map((p) => p.styles).join('\n')}
</head>
<body>
${parts.map((p) => p.body).join('\n')}
</body>
</html>`;

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(combined, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  console.log('pages=', doc.numPages);
  let pass = true;
  for (let p = 1; p <= doc.numPages; p++) {
    const pdfPage = await doc.getPage(p);
    const vp = pdfPage.getViewport({ scale: 1 });
    const ops = await pdfPage.getOperatorList();
    const stack = []; let ctm = [1, 0, 0, 1, 0, 0]; const rects = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() || ctm;
      else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
      else if (fn === OPS.paintImageXObject) {
        const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
        const w = pt2mm(Math.abs(pts[1][0] - pts[0][0]));
        if (w > 25 && w < 40) {
          rects.push({
            top: pt2mm(vp.height - Math.max(...pts.map((q) => q[1]))),
            left: pt2mm(Math.min(...pts.map((q) => q[0]))),
          });
        }
      }
    }
    const tops = [...new Set(rects.map((r) => r.top.toFixed(1)))];
    const lefts = [...new Set(rects.map((r) => r.left.toFixed(1)))];
    const ok = rects.length >= 1 && tops.length === 1 && lefts.length === 1;
    if (!ok) pass = false;
    console.log(`page ${p}: logos=${rects.length} tops=[${tops.join(',')}] lefts=[${lefts.join(',')}]${ok ? '' : ' ← FAIL'}`);
  }
  console.log(pass ? 'PASS：每頁有 logo，同頁 logo 完全疊合（視覺上只有一個）' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
