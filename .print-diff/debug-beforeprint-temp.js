// debug：體溫記錄模板 beforeprint 入面 getBoundingClientRect 嘅實際值
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
(async () => {
  const html = fs.readFileSync(path.join(root, 'upload/doc_html/院友體溫記錄.html'), 'utf8');
  const injected = html.replace('<body>', `<body><script>
window.__probe = null;
window.addEventListener('beforeprint', function () {
  var h1 = document.querySelector('h1');
  var r = document.createRange();
  r.setStart(h1.firstChild, 0); r.setEnd(h1.firstChild, 1);
  var rr = r.getBoundingClientRect();
  window.__probe = {
    rangeTop: rr.top, rangeH: rr.height,
    h1Top: h1.getBoundingClientRect().top,
    scrollY: window.scrollY, innerW: window.innerWidth, innerH: window.innerHeight,
    bodyH: document.body.getBoundingClientRect().height,
    mediaPrint: window.matchMedia('print').matches,
  };
});
<\/script>`);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 320, height: 200 } })).newPage();
  await page.setContent(injected, { waitUntil: 'load' });
  await page.pdf({ format: 'A4' });
  const probe = await page.evaluate(() => window.__probe);
  console.log(JSON.stringify(probe, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
