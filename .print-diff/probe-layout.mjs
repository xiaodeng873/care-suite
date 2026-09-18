import { chromium } from 'playwright-core';
import fs from 'fs';
const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
const r = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('[class^="print-doc-"]').forEach((w) => {
    const cs = getComputedStyle(w);
    out.push({
      cls: w.className,
      paddingLeft: cs.paddingLeft,
      width: cs.width,
      boxSizing: cs.boxSizing,
      rectLeft: w.getBoundingClientRect().left,
      firstTableLeft: w.querySelector('table')?.getBoundingClientRect().left,
    });
  });
  return out;
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
