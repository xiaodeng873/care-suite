const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage({ viewport: { width: 1800, height: 2400 }, deviceScaleFactor: 3 });
  await page.goto('file:///C:/Users/Admin/Desktop/care-suite/.tmp/consent-browser-test.pdf');
  await page.waitForTimeout(3500);
  // 性別列大約喺 x≈660-980, y≈1000-1060（CSS pixels）
  await page.screenshot({ path: '.tmp/gender-zoom.png', clip: { x: 660, y: 1000, width: 340, height: 70 } });
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e.message); process.exit(1); });
