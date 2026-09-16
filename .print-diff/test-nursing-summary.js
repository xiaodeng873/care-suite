// test-nursing-summary：驗證護理摘要（床頭卡式一頁速覽）列印版面
// data 模式：餐類組合/特殊餐膳/凝固粉由餐膳指引映射；A4 橫向
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
    entryPoints: [path.join(root, 'apps/web/src/utils/docHtmlGenerators/nursingSummaryGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { generateNursingSummaryHtml } = mod.exports;

  const base = {
    startDate: '2026-09-01', endDate: '2026-09-30', facilityName: '善頤(福群)護老院',
  };
  const patients = [
    { 院友id: 1, 中文姓名: '陳大文', 中文姓氏: '', 中文名字: '', 床號: 'A101-2' },
    { 院友id: 2, 中文姓名: '', 中文姓氏: '李', 中文名字: '美玲', 床號: 'B202-1' },
  ];
  const mealGuidances = [
    {
      id: 'g1', patient_id: 1, meal_combination: '軟飯+碎餸',
      special_diets: ['糖尿餐', '素食'], needs_thickener: true,
      thickener_formula: '清透配方', thickener_amount: '每餐2匙',
      created_at: '', updated_at: '',
    },
  ];
  const htmls = patients.map(p => generateNursingSummaryHtml({
    ...base, contentMode: 'data', patient: p, mealGuidances,
  }));
  fs.writeFileSync(path.join(__dirname, 'nursing-summary-sample.html'), htmls[0]);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(htmls[0], { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(path.join(__dirname, 'nursing-summary.pdf'), pdf);
  await page.setViewportSize({ width: 1123, height: 794 });
  await page.screenshot({ path: path.join(__dirname, 'nursing-summary-screen.png'), fullPage: true });

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const d = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  console.log('頁數:', d.numPages, '(預期 1)');
  const mm = (pt) => (pt * 25.4) / 72;
  const pg = await d.getPage(1);
  const vp = pg.getViewport({ scale: 1 });
  console.log(`p1: ${mm(vp.width).toFixed(0)}x${mm(vp.height).toFixed(0)}mm (預期 297x210 橫向)`);
  const text = (await pg.getTextContent()).items.map((it) => it.str).join(' ');
  const checks = [
    ['☑ 軟飯+碎餸（餐類組合映射）', text.includes('軟飯+碎餸') && text.indexOf('☑') >= 0],
    ['糖尿餐', text.includes('糖尿餐')],
    ['素食', text.includes('素食')],
    ['凝固粉：清透配方 每餐2匙（映射配方分量）', text.includes('每餐2匙')],
    ['無 ＿ 虛線字元（應全部係實線 span）', !text.includes('＿')],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  await browser.close();
})();
