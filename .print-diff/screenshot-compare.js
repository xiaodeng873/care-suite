const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve(__dirname, 'gen-out');
const tplDir = path.resolve(__dirname, '../doc_html');
const shotDir = path.resolve(__dirname, 'gen-shots');
fs.mkdirSync(shotDir, { recursive: true });

const cases = [
  { name: 'outing', tpl: '院友外出同意書.html', gen: 'outing.html' },
  { name: 'personal_p1p2', tpl: null, gen: 'personal_health_record.html' },
  { name: 'financial_return', tpl: '領回託管財物證明書.html', gen: 'financial_return.html' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });

  for (const c of cases) {
    if (c.tpl) {
      const page = await ctx.newPage();
      await page.emulateMedia({ media: 'print' });
      await page.goto('file:///' + path.join(tplDir, c.tpl).replace(/\\/g, '/'));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shotDir, `${c.name}.tpl.png`), fullPage: true });
      await page.close();
    }
    {
      const page = await ctx.newPage();
      await page.emulateMedia({ media: 'print' });
      await page.goto('file:///' + path.join(outDir, c.gen).replace(/\\/g, '/'));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shotDir, `${c.name}.gen.png`), fullPage: true });
      await page.close();
    }
    console.log('screenshot', c.name);
  }
  await browser.close();
})();
