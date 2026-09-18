import { chromium } from 'playwright-core';

const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle' });

// 實驗：淨係加 position:relative 俾 er 嘅 containers（唔郁其他嘢），睇分頁變唔變
const info = await page.evaluate(() => {
  const w = document.querySelector('.print-doc-0-4');
  const containers = w.querySelectorAll('.container');
  containers.forEach((c) => { c.style.position = 'relative'; });
  return { count: containers.length };
});
console.log(JSON.stringify(info));
const pdfPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/exp-relative.pdf';
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });

// 對照組：原樣直接出
const page2 = await browser.newPage();
await page2.setViewportSize({ width: 1200, height: 800 });
await page2.goto('file:///' + htmlPath, { waitUntil: 'networkidle' });
await page2.emulateMedia({ media: 'print' });
await page2.pdf({ path: 'C:/Users/Admin/Desktop/care-suite/.print-diff/exp-control.pdf', preferCSSPageSize: true, printBackground: true });
await browser.close();

// 比較兩個 PDF 頁數同每頁高度
import('pdfjs-dist/legacy/build/pdf.mjs').then(async (pdfjs) => {
  const fs = await import('fs');
  for (const [name, p] of [['relative', pdfPath], ['control', 'C:/Users/Admin/Desktop/care-suite/.print-diff/exp-control.pdf']]) {
    const data = new Uint8Array(fs.readFileSync(p));
    const doc = await pdfjs.getDocument({ data }).promise;
    const sizes = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      sizes.push(`${pg.view[2] > pg.view[3] ? 'L' : 'P'}${Math.round(pg.view[3])}`);
    }
    console.log(name, doc.numPages, 'pages:', sizes.join(' '));
  }
});
