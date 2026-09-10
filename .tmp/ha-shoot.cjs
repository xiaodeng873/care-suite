const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await page.goto('file:///C:/Users/Admin/Desktop/care-suite/.tmp/vacc-test.pdf');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '.tmp/vacc-pdf-view.png', fullPage: true });
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e.message); process.exit(1); });
