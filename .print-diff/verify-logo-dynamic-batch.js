// 批量驗證 dynamicAlign 殘差：每份文件注入 dynamic logo → print → 量 logo 頂 vs 字頂
// 用法：node verify-logo-dynamic-batch.js
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

// raw 範本文件
const RAW = ['院友護理評估記錄.html', '發佈資料同意書.html', '院友體溫記錄.html', '使用約束物品紀錄.html', '私人物品記錄表.html', '領回託管財物證明書.html'];

(async () => {
  const logoResult = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const logoMod = { exports: {} };
  new Function('module', 'exports', 'require', logoResult.outputFiles[0].text)(logoMod, logoMod.exports, require);
  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const logoSrc = `data:image/png;base64,${pngB64}`;

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const browser = await chromium.launch({ executablePath: CHROME });

  const measure = async (name, html) => {
    const withLogo = logoMod.exports.injectPageLogo(html, logoSrc, 1.3, true);
    const page = await (await browser.newContext({ viewport: { width: 320, height: 200 } })).newPage();
    await page.setContent(withLogo, { waitUntil: 'load' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
    const pdfPage = await doc.getPage(1);
    const pageHpt = pdfPage.getViewport({ scale: 1 }).height;
    const ops = await pdfPage.getOperatorList();
    const stack = []; let ctm = [1, 0, 0, 1, 0, 0];
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
    const pageWpt = pdfPage.getViewport({ scale: 1 }).width;
    // 揀右上角、闊度約 32mm 嗰張先係院舍 logo
    const logoRectPt = imgRects.find((r) => pt2mm(r.x1 - r.x0) > 25 && pt2mm(r.x1 - r.x0) < 40 && r.x0 > pageWpt * 0.7);
    const tc = await pdfPage.getTextContent();
    const title = tc.items.find((it) => (it.str || '').trim().startsWith('善'));
    if (!title || !logoRectPt) { console.log(`${name}: 量度失敗 (title=${!!title} logo=${!!logoRectPt})`); return; }
    const fsPt = Math.hypot(title.transform[1], title.transform[3]);
    const baselineRelMm = pt2mm(pageHpt - title.transform[5]) - 5;
    const glyphRelMm = baselineRelMm - pt2mm(0.72 * fsPt); // 標楷體 ascent ≈ 0.72em
    const logoRelMm = pt2mm(pageHpt - logoRectPt.y1) - 5;
    console.log(`${name}: logo=${logoRelMm.toFixed(2)}mm 字頂≈${glyphRelMm.toFixed(2)}mm 殘差=${(logoRelMm - glyphRelMm).toFixed(2)}mm (baseline rel=${baselineRelMm.toFixed(2)} fs=${pt2mm(fsPt).toFixed(2)}mm)`);
  };

  for (const f of RAW) {
    const fp = path.join(root, 'upload/doc_html', f);
    if (!fs.existsSync(fp)) { console.log(`${f}: 檔案不存在`); continue; }
    await measure(f, fs.readFileSync(fp, 'utf8'));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
