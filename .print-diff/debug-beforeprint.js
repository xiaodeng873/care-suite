// 測試：Chromium page.pdf() / window.print() 會唔會觸發 beforeprint，
// 以及 beforeprint 入面 getBoundingClientRect 係咪已經係 print layout（@page margin 生效）
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: A4; margin: 5mm; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.facility { font-size: 13pt; font-weight: bold; }
.logo { position: fixed; top: 5mm; right: 2mm; width: 32mm; }
</style></head><body>
<img class="logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==">
<div class="facility">善頤(福群)護老院</div>
<script>
window.__results = [];
var probe = function(tag) {
  var img = document.querySelector('.logo');
  var t = document.querySelector('.facility');
  var pxToMm = function(px) { return px * 25.4 / 96; };
  window.__results.push({ tag: tag,
    titleTopMm: Math.round(pxToMm(t.getBoundingClientRect().top) * 100) / 100,
    imgTopMm: Math.round(pxToMm(img.getBoundingClientRect().top) * 100) / 100 });
};
window.addEventListener('beforeprint', function() { probe('beforeprint'); });
probe('initial');
<\/script></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(HTML, { waitUntil: 'load' });
  const r1 = await page.evaluate(() => window.__results);
  console.log('initial(screen)=', JSON.stringify(r1));
  await page.pdf({ format: 'A4', printBackground: true });
  const r2 = await page.evaluate(() => window.__results);
  console.log('after page.pdf=', JSON.stringify(r2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
