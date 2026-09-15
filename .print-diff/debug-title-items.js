// debug：patrol/hygiene 頁一嘅 text items
const path = require('path');
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
(async () => {
  const which = process.argv[2];
  const entry = which === 'patrol'
    ? 'apps/web/src/utils/patrolRoundsHtmlExporter.ts'
    : 'apps/web/src/utils/hygieneRecordPrintFormHtml.ts';
  const result = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const html = which === 'patrol'
    ? mod.exports.generatePatrolRoundsRangeHtml({ bedNumber: 'A101-1', startDate: '2026-09-01', endDate: '2026-09-14', rounds: [], facilityName: '善頤(福群)護老院' })
    : mod.exports.generateHygieneRecordPrintFormHtml(
        [{ 院友id: 1, 中文姓名: '梁細妹', 出生日期: '1941-01-01', 性別: '女', 床號: 'C220-1' }],
        [{ year: 2026, month: 8, recordsByPatient: new Map() }],
        '善頤(福群)護老院');
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  const tc = await (await doc.getPage(1)).getTextContent();
  tc.items.slice(0, 12).forEach((it, i) => {
    console.log(i, JSON.stringify(it.str), 'y=', Math.round(it.transform[5] * 10) / 10, 'fs=', Math.round(Math.hypot(it.transform[1], it.transform[3]) * 10) / 10);
  });
})().catch((e) => { console.error(e); process.exit(1); });
