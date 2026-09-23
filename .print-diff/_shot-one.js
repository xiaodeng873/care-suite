const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const name = process.argv[2];
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.emulateMedia({ media: 'print' });
  await page.goto('file://' + path.resolve(__dirname, name + '.html').split(path.sep).join('/'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.resolve(__dirname, `${name}-s1.png`) });
  await page.evaluate(() => window.scrollTo(0, 1123));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.resolve(__dirname, `${name}-s2.png`) });
  await browser.close();
  console.log('done');
})();
