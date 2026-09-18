import { chromium } from 'playwright-core';

const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle' });
const info = await page.evaluate(() => {
  const PX_PER_MM = 96 / 25.4;
  const wrappers = Array.from(document.querySelectorAll('[class*="print-doc-"]'))
    .filter((el) => /^print-doc-\d+-\d+$/.test(el.className));
  const w = wrappers[6]; // activity_record
  const out = { cls: w.className, children: [], wrapperH: w.getBoundingClientRect().height / PX_PER_MM };
  Array.from(w.children).forEach((el) => {
    out.children.push({
      cls: typeof el.className === 'string' ? el.className : el.tagName,
      offsetTopMm: +(el.offsetTop / PX_PER_MM).toFixed(2),
      hMm: +(el.getBoundingClientRect().height / PX_PER_MM).toFixed(2),
    });
  });
  out.punchCount = w.querySelectorAll('.punch-guide-fixed').length;
  out.logoCount = w.querySelectorAll('img.admission-page-logo').length;
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
