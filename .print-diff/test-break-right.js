const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(`<!DOCTYPE html><html><head><style>
    @page { size: A4; margin: 10mm; }
    .doc + .doc { page-break-before: right; break-before: right; }
    .doc { height: 50mm; }
  </style></head><body>
    <div class="doc">DOC A (1 page)</div>
    <div class="doc">DOC B</div>
    <div class="doc">DOC C</div>
  </body></html>`, { waitUntil: 'load' });
  const pdf = await page.pdf({ format: 'A4' });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  console.log('pages =', doc.numPages, '(expect 5 if break-before:right works: A, blank, B, blank, C; 3 if ignored)');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
