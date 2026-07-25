const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve(__dirname, 'gen-out');
const shotDir = path.resolve(__dirname, 'gen-shots');
fs.mkdirSync(shotDir, { recursive: true });

const files = [
  { name: 'blood_pressure_test', file: path.join(outDir, 'blood_pressure_test.html') },
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  for (const f of files) {
    const page = await ctx.newPage();
    await page.emulateMedia({ media: 'print' });
    await page.goto('file:///' + f.file.replace(/\\/g, '/'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shotDir, `${f.name}.png`), clip: { x: 0, y: 0, width: 794, height: 1123 } });
    await page.close();
    console.log('shot', f.name);
  }
  await browser.close();
})();
