// 獨立列印 logo 驗證：
// 1) margin:5mm 文件（院友護理評估記錄）：normalize 後頁數唔變、內容唔變、logo @2mm
// 2) margin:0 文件（託管院友財物授權書P1，如有）：唔郁 margin，logo @2mm
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
  const { injectPageLogo } = await load('apps/web/src/utils/printPageLogo.ts');
  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const logoSrc = `data:image/png;base64,${pngB64}`;

  const browser = await chromium.launch({ executablePath: CHROME });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;

  const printAndAnalyze = async (html) => {
    const page = await (await browser.newContext()).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const pdfBuf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await page.close();
    const d = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
    const out = [];
    for (let p = 1; p <= d.numPages; p++) {
      const pg = await d.getPage(p);
      const vp = pg.getViewport({ scale: 1 });
      const tc = await pg.getTextContent();
      const ops = await pg.getOperatorList();
      const stack = []; let ctm = [1, 0, 0, 1, 0, 0]; const logos = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() || ctm;
        else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
        else if (fn === OPS.paintImageXObject) {
          const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
          const w = pt2mm(Math.abs(pts[1][0] - pts[0][0]));
          if (w > 25 && w < 40) logos.push({ top: +pt2mm(vp.height - Math.max(...pts.map((q) => q[1]))).toFixed(1), left: +pt2mm(Math.min(...pts.map((q) => q[0]))).toFixed(1) });
        }
      }
      out.push({ text: tc.items.map((it) => it.str).join(''), logos });
    }
    return out;
  };

  let pass = true;
  for (const file of ['院友護理評估記錄.html', '託管院友財物授權書P1.html', '院友體溫記錄.html']) {
    const rawHtml = fs.readFileSync(path.join(root, 'upload/doc_html', file), 'utf8');
    const withLogo = injectPageLogo(rawHtml, logoSrc);
    const before = await printAndAnalyze(rawHtml);
    const after = await printAndAnalyze(withLogo);
    const samePages = before.length === after.length;
    const sameText = before.every((pg, i) => pg.text === after[i]?.text);
    const logosOk = after.every((pg) => pg.logos.length === 1 && Math.abs(pg.logos[0].top - 2) < 0.6 && Math.abs(pg.logos[0].left - (210 - 2 - 32)) < 1);
    console.log(`${file}: 頁數 ${before.length}→${after.length}${samePages ? '' : ' ← 變咗!'} 內容${sameText ? '不變' : '← 變咗!'}`);
    after.forEach((pg, i) => console.log(`  page ${i + 1}: logos=${pg.logos.length} @${pg.logos.map((l) => `${l.top},${l.left}`).join(' ')}`));
    if (!samePages || !sameText || !logosOk) { pass = false; console.log('  ← FAIL'); }
  }
  await browser.close();
  console.log(pass ? 'PASS：獨立列印 logo 統一 @2mm，頁數同內容唔變' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
