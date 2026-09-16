// test-meal-card：驗證餐膳指引卡片備註列（凝固粉 + 需限水，「；」分隔，紅色字）
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
    entryPoints: [path.join(root, 'apps/web/src/utils/mealGuidanceCardPrintGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { generateMealGuidanceCardHtml } = mod.exports;

  const patients = [{ 院友id: 1, 中文姓名: '陳大文', 中文姓氏: '', 中文名字: '', 床號: 'A101-2', station_id: 's1' }];
  const mealGuidances = [
    {
      id: 'g1', patient_id: 1, meal_combination: '軟飯+碎餸', special_diets: [],
      needs_thickener: true, thickener_amount: '每餐2匙', thickener_formula: '清透配方',
      needs_water_restriction: true, water_restriction_amount_ml: 1000,
      created_at: '', updated_at: '',
    },
  ];
  const stations = [{ id: 's1', name: 'A區', color: '#fde047' }];
  const html = generateMealGuidanceCardHtml({ patients, mealGuidances, stations });
  fs.writeFileSync(path.join(__dirname, 'meal-card-sample.html'), html);

  const checks = [
    ['凝固粉指示在備註', html.includes('凝固粉 每餐2匙（清透配方）')],
    ['限水在備註', html.includes('每日限水 1000ml')],
    ['「；」分隔兩項', html.includes('凝固粉 每餐2匙（清透配方）』'.replace('』', '') + '；每日限水 1000ml')],
    ['紅色字 class', html.includes('mg-footer-red')],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.screenshot({ path: path.join(__dirname, 'meal-card-screen.png') });
  await browser.close();
})();
