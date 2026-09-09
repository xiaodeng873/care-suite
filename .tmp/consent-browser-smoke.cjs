// 喺真正 browser 環境（vite dev server + fontkit browser build）執行 consent util
const { chromium } = require('playwright-core');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  page.on('console', m => console.log('[browser]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:3000/consent-smoke.html');
  await page.waitForFunction(() => window.__result, null, { timeout: 30000 });
  const result = await page.evaluate(() => window.__result);
  await browser.close();
  if (!result.ok) { console.error('RUNTIME FAIL:', result.error); process.exit(1); }
  fs.writeFileSync('.tmp/consent-browser-test.pdf', Buffer.from(result.bytes));
  console.log('PDF bytes:', result.size);
})();
