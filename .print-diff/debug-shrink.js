const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { PDFDocument } = require('pdf-lib');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const base = fs.readFileSync(path.join(__dirname, 'gen-out/debug_nursing_treatment.html'), 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME });
  for (const h of [287, 286.5, 286, 285]) {
    const html = base.replace('min-height: 287mm', `min-height: ${h}mm`);
    const page = await (await browser.newContext()).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log('direct min-height', h, 'pdfPages=', pdfDoc.getPageCount());
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
