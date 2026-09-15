// 批量量度 raw 範本文件：注入固定 top:1.3mm logo → print → 計出令 logo 頂對齊字頂嘅 topMm
// 輸出 docId 對照用嘅 topMm 表
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

// docId → 範本檔（raw template 文件；P2 同 P1 家族用同一值）
const RAW_DOCS = {
  personal_health_record: ['院友個人及健康記錄P1.html'],
  nursing_assessment: ['院友護理評估記錄.html'],
  doctor_visit: ['醫生診治記錄.html'],
  orientation_plan: ['新院友入住導向計劃紀錄.html'],
  publicity_consent: ['發佈資料同意書.html'],
  outing_consent: ['院友外出同意書.html'],
  personal_belongings: ['私人物品記錄表.html'],
  financial_proxy_p1: ['託管院友財物授權書P1.html'],
  financial_proxy_p2: ['託管院友財物授權書P2.html'],
  financial_return: ['領回託管財物證明書.html'],
  accident_report: ['doc_html/意外事件報告.html'],
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

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const browser = await chromium.launch({ executablePath: CHROME });

  const results = {};
  for (const [docId, files] of Object.entries(RAW_DOCS)) {
    const fp = path.join(root, files[0].includes('/') ? files[0] : 'upload/doc_html/' + files[0]);
    if (!fs.existsSync(fp)) { console.log(`${docId}: 缺檔 ${files[0]}`); continue; }
    const html = logoMod.exports.injectPageLogo(fs.readFileSync(fp, 'utf8'), logoSrc, 1.3);
    const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
    const pdfPage = await doc.getPage(1);
    const vp = pdfPage.getViewport({ scale: 1 });
    const pageHpt = vp.height, pageWpt = vp.width;
    const ops = await pdfPage.getOperatorList();
    const stack = []; let ctm = [1, 0, 0, 1, 0, 0]; const imgRects = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() || ctm;
      else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
      else if (fn === OPS.paintImageXObject) {
        const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
        imgRects.push({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) });
      }
    }
    const logoRect = imgRects.find((r) => { const w = pt2mm(r.x1 - r.x0); return w > 25 && w < 40 && r.x0 > pageWpt * 0.7; });
    const tc = await pdfPage.getTextContent();
    const title = tc.items.find((it) => (it.str || '').trim().startsWith('善'));
    if (!title || !logoRect) { console.log(`${docId}: 量度失敗`); continue; }
    const fsPt = Math.hypot(title.transform[1], title.transform[3]);
    // 由範本 CSS 解析 @page 上邊界（mm）；margin: 0 / margin: 5mm 0.25in / margin: 5mm 等
    const pageCss = html.match(/@page\s*\{[\s\S]*?\}/);
    let marginMm = 0;
    const mMatch = pageCss && pageCss[0].match(/margin(?:-top)?\s*:\s*([^;}]+)/);
    if (mMatch) {
      const first = mMatch[1].trim().split(/\s+/)[0];
      const num = parseFloat(first);
      if (isFinite(num)) {
        if (first.endsWith('mm')) marginMm = num;
        else if (first.endsWith('cm')) marginMm = num * 10;
        else if (first.endsWith('in')) marginMm = num * 25.4;
        else if (first.endsWith('px')) marginMm = (num * 25.4) / 96;
        else if (first === '0') marginMm = 0;
      }
    }
    const baselineRelMm = pt2mm(pageHpt - title.transform[5]) - marginMm;
    const logoRelMm = pt2mm(pageHpt - logoRect.y1) - marginMm;
    const glyphRelMm = baselineRelMm - pt2mm(0.72 * fsPt); // 標楷體 ascent ≈ 0.72em
    const topMm = Math.round((1.3 + glyphRelMm - logoRelMm) * 10) / 10;
    results[docId] = topMm;
    console.log(`${docId}: baseline rel=${baselineRelMm.toFixed(2)} fs=${pt2mm(fsPt).toFixed(2)} 字頂≈${glyphRelMm.toFixed(2)} logoRel=${logoRelMm.toFixed(2)} → topMm=${topMm}`);
  }
  console.log('\n表：', JSON.stringify(results));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
