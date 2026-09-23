// 用 headless Chrome 將兩版 HTML 各自 print-to-PDF，然後對比
const path = require('path');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  for (const name of ['restraint-standalone', 'restraint-bundle-sim']) {
    await page.goto('file://' + path.resolve(__dirname, `${name}.html`).replace(/\\/g, '/'));
    await page.waitForTimeout(800);
    await page.pdf({
      path: path.resolve(__dirname, `${name}.pdf`),
      format: 'A4',
      printBackground: true,
      // 模擬列印：唔設 margin，等文件自己嘅 @page 話事
      preferCSSPageSize: true,
    });
    console.log(`${name}.pdf done`);
  }
  await browser.close();
})();
