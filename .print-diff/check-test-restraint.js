const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const file = path.resolve(__dirname, 'test-restraint.html');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  const page = await ctx.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.goto('file:///' + file.replace(/\\/g, '/'));
  await page.waitForTimeout(800);
  const height = await page.evaluate(() => document.body.scrollHeight);
  const pages = Math.round(height / 1123);
  console.log(`scrollHeight=${height}px, approx pages=${pages}`);
  await page.screenshot({ path: path.resolve(__dirname, 'test-restraint.png'), fullPage: true });
  console.log('screenshot saved');
  await browser.close();
})();
