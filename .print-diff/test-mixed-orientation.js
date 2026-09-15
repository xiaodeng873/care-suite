// 驗證 Chrome 同一文件混合 portrait / landscape 具名 @page
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(`<!DOCTYPE html><html><head><style>
    html, body { margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 0; }
    @page pg-port { size: A4 portrait; margin: 5mm; }
    @page pg-land { size: A4 landscape; margin: 5mm 10mm; }
    .doc + .doc { page-break-before: always; }
    .p { page: pg-port; height: 50mm; }
    .l { page: pg-land; height: 50mm; }
  </style></head><body>
    <div class="doc p">PORTRAIT A</div>
    <div class="doc l">LANDSCAPE ER</div>
    <div class="doc p">PORTRAIT B</div>
  </body></html>`, { waitUntil: 'load' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await browser.close();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const d = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  console.log('pages =', d.numPages);
  for (let p = 1; p <= d.numPages; p++) {
    const pg = await d.getPage(p);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const wMm = (vp.width * 25.4 / 72).toFixed(0);
    const hMm = (vp.height * 25.4 / 72).toFixed(0);
    console.log(`  page ${p}: ${wMm}x${hMm}mm | ${tc.items.map((i) => i.str).join('')}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
