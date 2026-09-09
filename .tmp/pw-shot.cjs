const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage({ viewport: { width: 1800, height: 2400 } });
  await page.goto('file:///C:/Users/Admin/Desktop/care-suite/.tmp/consent-browser-test.pdf');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '.tmp/browser2-viewer.png', fullPage: true });
  await browser.close();
  console.log('screenshot done');
})().catch(e => { console.error(e.message); process.exit(1); });
