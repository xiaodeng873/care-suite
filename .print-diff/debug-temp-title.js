// debug：體溫記錄 raw 模板 screen layout 入面 h1 位置
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const px2mm = (px) => (px * 25.4) / 96;
(async () => {
  const html = fs.readFileSync(path.join(root, 'upload/doc_html/院友體溫記錄.html'), 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 320, height: 200 } })).newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const m = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const r = document.createRange();
    r.setStart(h1.firstChild, 0); r.setEnd(h1.firstChild, 1);
    const rr = r.getBoundingClientRect();
    const cont = h1.closest('.container');
    return {
      rangeTopPx: rr.top,
      h1TopPx: h1.getBoundingClientRect().top,
      containerTopPx: cont ? cont.getBoundingClientRect().top : null,
      bodyFirst: document.body.firstElementChild && document.body.firstElementChild.tagName + '.' + document.body.firstElementChild.className,
      scrollY: window.scrollY,
      bodyChildren: Array.from(document.body.children).slice(0, 5).map((c) => c.tagName + '.' + c.className),
    };
  });
  console.log(JSON.stringify(m, null, 1));
  console.log('rangeTop mm=', px2mm(m.rangeTopPx).toFixed(2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
