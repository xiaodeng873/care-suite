const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve(__dirname, 'gen-out');
const shotDir = path.resolve(__dirname, 'gen-shots');
fs.mkdirSync(shotDir, { recursive: true });

const files = [
  { name: 'financial_return_test', file: path.join(outDir, 'financial_return_test.html') },
  { name: 'personal_health_record_test_p1', file: path.join(outDir, 'personal_health_record_test.html'), page: 0 },
  { name: 'personal_health_record_test_p2', file: path.join(outDir, 'personal_health_record_test.html'), page: 1 },
  { name: 'nursing_assessment_test', file: path.join(outDir, 'nursing_assessment_test.html') },
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  for (const f of files) {
    const page = await ctx.newPage();
    await page.emulateMedia({ media: 'print' });
    await page.goto('file:///' + f.file.replace(/\\/g, '/'));
    await page.waitForTimeout(500);
    const clip = f.page !== undefined
      ? { x: 0, y: f.page * 1123, width: 794, height: 1123 }
      : { x: 0, y: 0, width: 794, height: 1123 };
    await page.screenshot({ path: path.join(shotDir, `${f.name}.png`), clip });
    await page.close();
    console.log('shot', f.name);
  }
  await browser.close();
})();
