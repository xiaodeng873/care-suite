import { chromium } from 'playwright-core';
const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
const r = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.punch-guide-fixed').forEach((el) => {
    // 淨睇 financial proxy (print-doc-0-2)
    if (!el.closest('.print-doc-0-2')) return;
    const chain = [];
    let p = el;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      chain.push({
        tag: p.tagName + (p.className ? '.' + String(p.className).split(' ').slice(0,2).join('.') : ''),
        position: cs.position, zoom: cs.zoom, transform: cs.transform,
        filter: cs.filter, contain: cs.contain, willChange: cs.willChange,
        perspective: cs.perspective,
      });
      p = p.parentElement;
    }
    out.push({ top: el.style.top, chain });
  });
  return out.slice(0, 1);
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
