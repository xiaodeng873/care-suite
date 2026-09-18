import { chromium } from 'playwright-core';

const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle' });
const info = await page.evaluate(() => {
  const wrapper = document.querySelector('.print-doc-0-0');
  const PX_PER_MM = 96 / 25.4;
  const out = { children: [], breakSelectorsFound: [] };
  const allCss = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
  const RULE_RE = /([^{}@][^{}]*)\{([^{}]*)\}/g;
  let m; const sels = [];
  while ((m = RULE_RE.exec(allCss))) {
    if (/(?:page-)?break-(?:before|after)\s*:\s*(always|page)\b/i.test(m[2])) sels.push(m[1].trim());
  }
  out.breakSelectorsFound = sels;
  let matchCount = 0;
  try { matchCount = wrapper.querySelectorAll(sels.join(',')).length; } catch (e) { out.qsError = String(e); }
  out.matchCount = matchCount;
  Array.from(wrapper.children).forEach((el) => {
    const cs = getComputedStyle(el);
    out.children.push({
      cls: typeof el.className === 'string' ? el.className : '',
      tag: el.tagName,
      offsetTopMm: +(el.offsetTop / PX_PER_MM).toFixed(2),
      breakBefore: cs.breakBefore || cs.pageBreakBefore,
      breakAfter: cs.breakAfter || cs.pageBreakAfter,
      heightMm: +(el.getBoundingClientRect().height / PX_PER_MM).toFixed(2),
    });
  });
  const wcs = getComputedStyle(wrapper);
  out.wrapper = { heightMm: +(wrapper.getBoundingClientRect().height / PX_PER_MM).toFixed(2), paddingLeft: wcs.paddingLeft, position: wcs.position };
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
