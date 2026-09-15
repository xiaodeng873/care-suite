// 驗證：logo 頂邊 對齊 院舍名稱頂邊（個人出入量記錄表）
// 方法：Chrome 列印 → PDF，pdfjs 讀 op stream（cm + paintImageXObject）同 textContent，
// 計算 logo 影像頂部 y 同院舍名稱字元頂部 y（baseline + ascent），比較兩者（由頁頂計，mm）。
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

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/intakeOutputHtmlGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const logoResult = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const logoMod = { exports: {} };
  new Function('module', 'exports', 'require', logoResult.outputFiles[0].text)(logoMod, logoMod.exports, require);

  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const logoSrc = `data:image/png;base64,${pngB64}`;

  const html = mod.exports.generateIntakeOutputHtml({
    facilityName: '善頤(福群)護老院',
    patientName: '梁細妹', bedNumber: 'C220-1', genderAge: '女/85',
    recordDate: '2026/08/16', targetIntakeMl: 1500, rows: [],
  });
  const withLogo = logoMod.exports.injectPageLogo(html, logoSrc);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(withLogo, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  const pdfPage = await doc.getPage(1);
  const vp = pdfPage.getViewport({ scale: 1 });
  const pageHpt = vp.height;

  // logo 影像：搵 paintImageXObject 前最近一個 cm
  const ops = await pdfPage.getOperatorList();
  let lastCm = null;
  let imgMatrix = null;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === OPS.transform) lastCm = ops.argsArray[i];
    if (ops.fnArray[i] === OPS.paintImageXObject) { imgMatrix = lastCm; break; }
  }
  let logoTopFromTopMm = null, logoBox = null;
  if (imgMatrix) {
    const [a, b, c, d, e, f] = imgMatrix;
    // Chrome print：y 向下，cm = [w 0 0 h x y]，影像 top y(pt) = f，bottom = f + d
    logoBox = { xMm: pt2mm(e), topMm: pt2mm(f), wMm: pt2mm(a), hMm: pt2mm(Math.abs(d)) };
    logoTopFromTopMm = pt2mm(f);
  }

  // 院舍名稱文字：搵第一個含「善頤」嘅 text item
  const tc = await pdfPage.getTextContent();
  let title = null;
  for (const it of tc.items) {
    const s = it.str || '';
    if (s.includes('善頤')) {
      const [, , , , e, f] = it.transform;
      const fontSizePt = Math.hypot(it.transform[1], it.transform[3]); // 垂直方向字體大小
      title = { str: s, baselineFromTopMm: pt2mm(pageHpt - f), fontSizePt, fontSizeMm: pt2mm(fontSizePt) };
      break;
    }
  }
  if (!title) { console.error('搵唔到院舍名稱文字'); process.exit(1); }

  // 中文字元視覺頂 ≈ baseline - 0.88 × fontSize（由頁頂計）
  const ascentPt = 0.88 * title.fontSizePt;
  const glyphTopMm = title.baselineFromTopMm - pt2mm(ascentPt);

  console.log('logoBox=', JSON.stringify(logoBox));
  console.log('title=', JSON.stringify(title));
  console.log('logo 頂部(由頁頂)=', logoTopFromTopMm?.toFixed(2), 'mm');
  console.log('院舍名稱字頂(由頁頂)≈', glyphTopMm.toFixed(2), 'mm（baseline - 0.88em）');
  console.log('差距=', (logoTopFromTopMm != null ? (logoTopFromTopMm - glyphTopMm) : NaN).toFixed(2), 'mm（正=logo 較高）');
})().catch(e => { console.error(e); process.exit(1); });
