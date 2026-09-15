// debug：財務文件頁面 1 嘅全部影像 rect
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
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}
const applyM = (m, x, y) => { const [a, b, c, d, e, f] = m; return [a * x + c * y + e, b * x + d * y + f]; };
(async () => {
  const logoResult = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const logoMod = { exports: {} };
  new Function('module', 'exports', 'require', logoResult.outputFiles[0].text)(logoMod, logoMod.exports, require);
  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const html = logoMod.exports.injectPageLogo(
    fs.readFileSync(path.join(root, 'upload/doc_html/領回託管財物證明書.html'), 'utf8'),
    `data:image/png;base64,${pngB64}`, 1.3);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  console.log('pages=', doc.numPages);
  const pdfPage = await doc.getPage(1);
  const vp = pdfPage.getViewport({ scale: 1 });
  console.log('page mm=', pt2mm(vp.width).toFixed(1), 'x', pt2mm(vp.height).toFixed(1));
  const ops = await pdfPage.getOperatorList();
  const stack = []; let ctm = [1, 0, 0, 1, 0, 0]; const imgRects = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || ctm;
    else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
    else if (fn === OPS.paintImageXObject) {
      const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
      imgRects.push({
        w: pt2mm(Math.abs(pts[1][0] - pts[0][0])), h: pt2mm(Math.abs(pts[2][1] - pts[0][1])),
        x0: pt2mm(Math.min(...pts.map((p) => p[0]))), topFromTop: pt2mm(vp.height - Math.max(...pts.map((p) => p[1]))),
      });
    }
  }
  console.log(JSON.stringify(imgRects, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
