// 驗證 v2：完整合成 CTM（save/restore/transform），計出 logo 影像真實位置，
// 同院舍名稱字頂比較，求出每份文件令 logo 頂對齊字頂所需嘅 topMm。
// 用法：node verify-logo-topalign2.js <doc>  （doc = intake|diaper|patrol|hygiene）
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(stubDirPath());
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
  },
};
function stubDirPath() { return path.resolve(__dirname, 'stubs'); }
const pt2mm = (pt) => (pt * 25.4) / 72;

const DOCS = {
  intake: {
    entry: 'apps/web/src/utils/intakeOutputHtmlGenerator.ts',
    topMm: 1.3,
    gen: (m) => m.exports.generateIntakeOutputHtml({
      facilityName: '善頤(福群)護老院', patientName: '梁細妹', bedNumber: 'C220-1',
      genderAge: '女/85', recordDate: '2026/08/16', targetIntakeMl: 1500, rows: [],
    }),
    findTitle: (tc) => tc.items.find((it) => (it.str || '').trim().startsWith('善')),
  },
  diaper: {
    entry: 'apps/web/src/utils/diaperRecordPrintFormHtml.ts',
    topMm: 0.9,
    gen: (m) => m.exports.generateDiaperRecordFormForDateRange(
      { 院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試', 床號: 'A101-1' },
      [], '2026-09-01', '2026-09-04', '善頤(福群)護老院', false),
    findTitle: (tc) => tc.items.find((it) => (it.str || '').trim().startsWith('善')),
  },
  patrol: {
    entry: 'apps/web/src/utils/patrolRoundsHtmlExporter.ts',
    topMm: 1.8,
    gen: (m) => m.exports.generatePatrolRoundsRangeHtml({
      bedNumber: 'A101-1', startDate: '2026-09-01', endDate: '2026-09-14',
      rounds: [], facilityName: '善頤(福群)護老院',
    }),
    findTitle: (tc) => tc.items.find((it) => (it.str || '').trim().startsWith('善')),
  },
  hygiene: {
    entry: 'apps/web/src/utils/hygieneRecordPrintFormHtml.ts',
    topMm: 0.3,
    gen: (m) => m.exports.generateHygieneRecordPrintFormHtml(
      [{ 院友id: 1, 中文姓名: '梁細妹', 出生日期: '1941-01-01', 性別: '女', 床號: 'C220-1' }],
      [{ year: 2026, month: 8, recordsByPatient: new Map() }],
      '善頤(福群)護老院'),
    findTitle: (tc) => tc.items.find((it) => (it.str || '').trim().startsWith('善')),
  },
};

// 3x3 CTM 乘法：M = M * N（PDF 慣用 [a b c d e f]）
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
  const which = process.argv[2] || 'intake';
  const cfg = DOCS[which];
  if (!cfg) { console.error('unknown doc', which); process.exit(1); }

  const result = await esbuild.build({
    entryPoints: [path.join(root, cfg.entry)],
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

  const html = cfg.gen(mod);

  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const withLogo = logoMod.exports.injectPageLogo(html, `data:image/png;base64,${pngB64}`, cfg.topMm);

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
  const pageHpt = vp.height, pageWpt = vp.width;

  // 完整 CTM 合成搵 logo rect
  const ops = await pdfPage.getOperatorList();
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let logoRectPt = null;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || ctm;
    else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
    else if (fn === OPS.paintImageXObject) {
      const p00 = applyM(ctm, 0, 0);
      const p10 = applyM(ctm, 1, 0);
      const p01 = applyM(ctm, 0, 1);
      const p11 = applyM(ctm, 1, 1);
      const xs = [p00[0], p10[0], p01[0], p11[0]];
      const ys = [p00[1], p10[1], p01[1], p11[1]];
      logoRectPt = {
        x0: Math.min(...xs), x1: Math.max(...xs),
        y0: Math.min(...ys), y1: Math.max(...ys),
      };
      break;
    }
  }

  const tc = await pdfPage.getTextContent();
  const title = cfg.findTitle(tc);
  const [, , , , te, tf] = title.transform;
  const fontSizePt = Math.hypot(title.transform[1], title.transform[3]);

  // 字頂（PDF y 向上）：baseline tf + ascent
  const ascentPt = 0.88 * fontSizePt;
  const glyphTopYpt = tf + ascentPt;
  // 由頁頂計（mm）
  const titleTopFromTopMm = pt2mm(pageHpt - glyphTopYpt);
  let logoTopFromTopMm = null;
  if (logoRectPt) logoTopFromTopMm = pt2mm(pageHpt - logoRectPt.y1);

  console.log(`[${which}] page=${pt2mm(pageWpt).toFixed(1)}x${pt2mm(pageHpt).toFixed(1)}mm`);
  if (logoRectPt) console.log(`  logo rect: x=${pt2mm(logoRectPt.x0).toFixed(2)}..${pt2mm(logoRectPt.x1).toFixed(2)}mm  top=${logoTopFromTopMm.toFixed(2)}  h=${pt2mm(logoRectPt.y1 - logoRectPt.y0).toFixed(2)}mm`);
  console.log(`  院舍名稱字頂=${titleTopFromTopMm.toFixed(2)}mm (baseline=${pt2mm(pageHpt - tf).toFixed(2)}mm, font=${pt2mm(fontSizePt).toFixed(2)}mm)`);
  if (logoTopFromTopMm != null) {
    const needTopMm = logoTopFromTopMm + (titleTopFromTopMm - logoTopFromTopMm);
    console.log(`  差距=${(logoTopFromTopMm - titleTopFromTopMm).toFixed(2)}mm（正=logo 較高）→ 建議 top ≈ ${needTopMm.toFixed(1)}mm`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
