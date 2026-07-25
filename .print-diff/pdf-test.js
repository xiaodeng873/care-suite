const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve(__dirname, 'gen-out');
const shotDir = path.resolve(__dirname, 'gen-shots');
fs.mkdirSync(shotDir, { recursive: true });

const files = [
  { name: 'personal_health_record', file: path.join(outDir, 'personal_health_record_test.html') },
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  for (const f of files) {
    const page = await ctx.newPage();
    await page.goto('file:///' + f.file.replace(/\\/g, '/'));
    await page.waitForTimeout(500);
    await page.pdf({
      path: path.join(shotDir, `${f.name}.pdf`),
      format: 'A4',
      printBackground: true,
      margin: { top: '5mm', bottom: '5mm', left: '0.25in', right: '0.25in' },
    });
    await page.close();
    console.log('pdf', f.name);
  }
  await browser.close();
})();
