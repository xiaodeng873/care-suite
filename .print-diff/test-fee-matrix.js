// test-fee-matrix：驗證新雜費記錄報表（A4 橫向矩陣）列印版面
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
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
  },
};

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/feeStatementPrintFormHtml.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { generateFeeStatisticsReportHtml } = mod.exports;

  const patients = [
    { 院友id: 1, 中文姓名: '陳大文', 中文姓氏: '', 中文名字: '', 床號: 'A101-2' },
    { 院友id: 2, 中文姓名: '', 中文姓氏: '李', 中文名字: '美玲', 床號: 'B202-1' },
    { 院友id: 3, 中文姓名: '黃志明', 中文姓氏: '', 中文名字: '', 床號: '' },
  ];
  const html = generateFeeStatisticsReportHtml(patients, { month: '2026-09', facilityName: '善頤(福群)護老院' });
  fs.writeFileSync(path.join(__dirname, 'fee-matrix.html'), html);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(path.join(__dirname, 'fee-matrix.pdf'), pdf);

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const d = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  console.log('頁數:', d.numPages, '(預期 3 = 3 位院友各 1 頁)');
  const mm = (pt) => (pt * 25.4) / 72;
  for (let p = 1; p <= d.numPages; p++) {
    const pg = await d.getPage(p);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const text = tc.items.map((it) => it.str).join('');
    console.log(`p${p}: ${mm(vp.width).toFixed(0)}x${mm(vp.height).toFixed(0)}mm | ${text.slice(0, 60).replace(/\s+/g, ' ')}`);
  }
  await browser.close();
})();
