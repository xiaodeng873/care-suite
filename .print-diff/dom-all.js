const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const p = await (await b.newContext()).newPage();
  await p.goto('file:///' + path.resolve('shots/_all.combined.html').replace(/\\/g, '/'));
  await p.waitForTimeout(600);
  const info = await p.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="print-doc-"]')).map((w) => ({
      cls: w.className,
      scrollH: w.scrollHeight,
      rows: w.querySelectorAll('table tbody tr').length + w.querySelectorAll('table tr').length,
      text: w.textContent.replace(/\s+/g, ' ').trim().slice(0, 35),
    }));
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
