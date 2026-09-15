// debug：beforeprint 入面 Range/element rect 嘅實際數值，同 img 設定後嘅 style.top
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: A4; margin: 5mm; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.pw { padding: 8mm; }
.facility { font-size: 13pt; font-weight: bold; }
.logo { position: fixed; top: 1.3mm; right: 2mm; width: 32mm; }
</style></head><body>
<img class="logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==">
<div class="pw"><div class="facility">善頤(福群)護老院</div></div>
<script>
window.__results = [];
var probe = function(tag) {
  var img = document.querySelector('.logo');
  var t = document.querySelector('.facility');
  var pxToMm = function(px) { return px * 25.4 / 96; };
  var rec = { tag: tag,
    elTopMm: Math.round(pxToMm(t.getBoundingClientRect().top) * 100) / 100,
    imgTopMm: Math.round(pxToMm(img.getBoundingClientRect().top) * 100) / 100,
    scrollY: window.scrollY, innerH: window.innerHeight };
  try {
    var range = document.createRange();
    var node = t.firstChild;
    range.setStart(node, 0); range.setEnd(node, 1);
    var r = range.getBoundingClientRect();
    rec.rangeTopMm = Math.round(pxToMm(r.top) * 100) / 100;
    rec.rangeHMm = Math.round(pxToMm(r.height) * 100) / 100;
  } catch (e) { rec.err = String(e); }
  window.__results.push(rec);
};
var align = function() {
  probe('beforeprint');
  var img = document.querySelector('.logo');
  var t = document.querySelector('.facility');
  var range = document.createRange();
  range.setStart(t.firstChild, 0); range.setEnd(t.firstChild, 1);
  img.style.top = range.getBoundingClientRect().top + 'px';
  window.__results.push({ tag: 'set', styleTop: img.style.top });
  requestAnimationFrame(function(){ probe('after-set-rAF'); });
};
window.addEventListener('beforeprint', align);
probe('initial');
<\/script></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(HTML, { waitUntil: 'load' });
  await page.pdf({ format: 'A4', printBackground: true });
  const r = await page.evaluate(() => window.__results);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
