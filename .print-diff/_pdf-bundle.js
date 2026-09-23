// 將合併 HTML 用 Chrome print-to-PDF（preferCSSPageSize 等於真實列印），逐頁截圖輸出
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, 'bundle-real-0.html').split(path.sep).join('/'));
  await page.waitForTimeout(1500);
  await page.pdf({
    path: path.resolve(__dirname, 'bundle-real-0.pdf'),
    preferCSSPageSize: true,
    printBackground: true,
  });
  await browser.close();
  console.log('pdf done');
})();
