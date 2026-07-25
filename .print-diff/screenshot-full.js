const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve(__dirname, 'gen-out');
const shotDir = path.resolve(__dirname, 'gen-shots');
fs.mkdirSync(shotDir, { recursive: true });

const files = [
  { name: 'personal_health_record_full', file: path.join(outDir, 'personal_health_record_test.html') },
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 794, height: 2400 } });
  for (const f of files) {
    const page = await ctx.newPage();
    await page.emulateMedia({ media: 'print' });
    await page.goto('file:///' + f.file.replace(/\\/g, '/'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(shotDir, `${f.name}.png`), fullPage: true });
    await page.close();
    console.log('shot', f.name);
  }
  await browser.close();
})();
