// 用 print media emulation 截圖兩版，肉眼對比排版差異
const path = require('path');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox'],
  });
  for (const name of ['restraint-standalone', 'restraint-bundle-sim']) {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } }); // A4 @96dpi
    await page.emulateMedia({ media: 'print' });
    await page.goto('file://' + path.resolve(__dirname, `${name}.html`).replace(/\\/g, '/'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.resolve(__dirname, `${name}-p1.png`) });
    // 捲到第二頁區域再截
    await page.evaluate(() => window.scrollTo(0, 1123));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, `${name}-p2.png`) });
    console.log(`${name} screenshots done`);
    await page.close();
  }
  await browser.close();
})();
