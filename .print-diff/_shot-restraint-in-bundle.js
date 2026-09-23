// 喺合併文件入面搵出指定標題嘅文件容器，截佢嘅圖
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.emulateMedia({ media: 'print' });
  await page.goto('file://' + path.resolve(__dirname, 'bundle-real-0.html').split(path.sep).join('/'));
  await page.waitForTimeout(1200);
  const handle = await page.evaluateHandle(() => {
    const docs = document.querySelectorAll('[class*="print-doc-"]');
    for (const d of docs) {
      if (d.textContent && d.textContent.includes('使用約束措施的評估及同意書')) return d;
    }
    return null;
  });
  const el = handle.asElement();
  if (!el) { console.log('NOT FOUND'); await browser.close(); return; }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = await el.boundingBox();
  console.log('box', JSON.stringify(box));
  // 截容器頂部一頁高
  await page.screenshot({
    path: path.resolve(__dirname, 'bundle-restraint-in-combined.png'),
    clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, 794), height: 1123 },
  });
  await page.screenshot({
    path: path.resolve(__dirname, 'bundle-restraint-in-combined-p2.png'),
    clip: { x: Math.max(0, box.x), y: box.y + 1123, width: Math.min(box.width, 794), height: 1123 },
  });
  await browser.close();
  console.log('done');
})();
