// 驗證 dynamicAlign：院友護理評估記錄範本（含 .no-print 列印按鈕、標楷體 h1 26px、line-height 1.55）
// 模擬 app 環境：細 viewport（似 0x0 iframe 嘅 constrained layout），beforeprint 腳本應自動對齊字頂
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
  const [a1, b1, c1, d1, e1, f1] = m;
  const [a2, b2, c2, d2, e2, f2] = n;
  return [
    a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
  ];
}
const applyM = (m, x, y) => {
  const [a, b, c, d, e, f] = m;
  return [a * x + c * y + e, b * x + d * y + f];
};

(async () => {
  const logoResult = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const logoMod = { exports: {} };
  new Function('module', 'exports', 'require', logoResult.outputFiles[0].text)(logoMod, logoMod.exports, require);

  const html = fs.readFileSync(path.join(root, 'upload/doc_html/院友護理評估記錄.html'), 'utf8');
  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const withLogo = logoMod.exports.injectPageLogo(html, `data:image/png;base64,${pngB64}`, 1.3, true);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 320, height: 200 } })).newPage();
  await page.setContent(withLogo, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  const pdfPage = await doc.getPage(1);
  const vp = pdfPage.getViewport({ scale: 1 });
  const pageHpt = vp.height;

  const ops = await pdfPage.getOperatorList();
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const imgRects = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || ctm;
    else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
    else if (fn === OPS.paintImageXObject) {
      const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
      imgRects.push({
        x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])),
        y1: Math.max(...pts.map((p) => p[1])),
      });
    }
  }
  const pageWpt = vp.width;
  const logoRectPt = imgRects.find((r) => pt2mm(r.x1 - r.x0) > 25 && pt2mm(r.x1 - r.x0) < 40 && r.x0 > pageWpt * 0.7);

  const tc = await pdfPage.getTextContent();
  const title = tc.items.find((it) => (it.str || '').trim().startsWith('善'));
  if (!title) { console.error('搵唔到標題'); process.exit(1); }
  const [, , , , , tf] = title.transform;
  const fontSizePt = Math.hypot(title.transform[1], title.transform[3]);
  // 標楷體 ascent ≈ 0.72em
  const glyphTopYpt = tf + 0.72 * fontSizePt;
  const titleTopFromTopMm = pt2mm(pageHpt - glyphTopYpt);
  const logoTopFromTopMm = logoRectPt ? pt2mm(pageHpt - logoRectPt.y1) : null;

  console.log('logo 頂部(由頁頂)=', logoTopFromTopMm?.toFixed(2), 'mm');
  console.log('院舍名稱字頂(由頁頂)=', titleTopFromTopMm.toFixed(2), 'mm (baseline', pt2mm(pageHpt - tf).toFixed(2), 'mm, font', pt2mm(fontSizePt).toFixed(2), 'mm)');
  if (logoTopFromTopMm != null) console.log('差距=', (logoTopFromTopMm - titleTopFromTopMm).toFixed(2), 'mm');
})().catch((e) => { console.error(e); process.exit(1); });
