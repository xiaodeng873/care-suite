// 測試護理及治療記錄剛好 35 列時會否超頁，以及每頁最後一列位置
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const { PDFDocument } = require('pdf-lib');

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
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/patientLogNursingTreatmentGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);

  const dummyPatient = {
    院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友',
    床號: 'A101-1', 性別: '女', 出生日期: '1929-01-01', 在住狀態: '在住',
  };

  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();

  for (const n of [35, 34, 36]) {
    const logs = [];
    for (let i = 0; i < n; i++) {
      logs.push({
        id: `L${i}`, patient_id: 999,
        log_date: `2025-07-${String((i % 28) + 1).padStart(2, '0')}`,
        log_type: '其他', content: `測試護理內容 ${i}`, recorder: '測試員',
      });
    }
    const html = await mod.exports.generatePatientLogNursingTreatmentHtml(logs, [dummyPatient], logs.map(l => l.id));
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const measure = await page.evaluate(() => {
      const pxToMm = (px) => (px * 25.4) / 96;
      const pages = Array.from(document.querySelectorAll('.page'));
      const rows = Array.from(document.querySelectorAll('.page .data-row'));
      return {
        pageHeights: pages.map(p => Math.round(pxToMm(p.getBoundingClientRect().height) * 100) / 100),
        lastRowBottomMm: rows.length ? Math.round(pxToMm(rows[rows.length - 1].getBoundingClientRect().bottom + window.scrollY) * 100) / 100 : null,
        bodyHeightMm: Math.round(pxToMm(document.body.scrollHeight) * 100) / 100,
      };
    });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log(`rows=${n}`, JSON.stringify(measure), 'pdfPages=', pdfDoc.getPageCount());
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
