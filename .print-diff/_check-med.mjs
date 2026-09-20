import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const stubPlugin = { name: 'stubs', setup(b) {
  b.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
  b.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
}};
const rawPlugin = { name: 'raw', setup(b) {
  b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
  b.onLoad({ filter: /.*/, namespace: 'raw' }, async (a) => {
    const fs = await import('fs');
    return { contents: `export default ${JSON.stringify(fs.readFileSync(a.path, 'utf-8'))};`, loader: 'js' };
  });
}};
const bundle = async (f) => {
  const r = await esbuild.build({ entryPoints: [path.join(root, f)], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [stubPlugin, rawPlugin] });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const med = await bundle('apps/web/src/utils/medicationListHtmlGenerator.ts');
const patient = {
  院友id: 999, 中文姓名: '關永安', 床號: 'C227-1', 性別: '男', 出生日期: '1961-01-01', 身份證號碼: 'E930771(4)', 藥物敏感: [],
  prescriptions: [
    { medication_name: 'INSULIN GLARGINE (LANTUS SOLOSTAR) PREFILLED PEN 100U/ML 3ML', administration_route: '皮下注射', dosage_form: '注射劑', meal_timing: '早餐前', frequency_type: 'daily', daily_frequency: 1, dosage_amount: 1, dosage_unit: '次', start_date: '2026-09-18' },
    { medication_name: 'PREDNISOLONE TABLET 5MG', administration_route: '口服', dosage_form: '藥片', frequency_type: 'daily', daily_frequency: 1, dosage_amount: 1, dosage_unit: '粒', start_date: '2026-09-18' },
  ],
};
const html = await med.generateMedicationListHtml([patient], { termType: 'long' });
console.log('textarea in doc:', (html.match(/<textarea/g) || []).length, '(應只餘空行嘅)');
console.log('db-text-div count:', (html.match(/db-text-div/g) || []).length);
const browser = await chromium.launch({ executablePath: CHROME });
const page = await (await browser.newContext()).newPage();
await page.setContent(html, { waitUntil: 'load' });
const info = await page.evaluate(() => {
  const PX = 96/25.4;
  const rows = Array.from(document.querySelectorAll('tr.data-row')).slice(0, 3);
  return rows.map(r => {
    const div = r.querySelector('.db-text-div');
    const ta = r.querySelector('textarea');
    return {
      rowMm: (r.getBoundingClientRect().height / PX).toFixed(1),
      cell: div ? 'div' : (ta ? 'textarea' : '?'),
      scrollable: ta ? (ta.scrollHeight > ta.clientHeight) : false,
      text: (div || ta)?.textContent?.slice(0, 40),
    };
  });
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
