// 量度 doc_html 原版文件的列印頂部高度及頁數
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { PDFDocument } = require('pdf-lib');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');

(async () => {
  const docs = ['doc_html/護理及治療記錄.html', 'doc_html/生命表徵觀察記錄表.html'];
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  for (const rel of docs) {
    const file = path.join(root, rel);
    const html = fs.readFileSync(file, 'utf8');
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const measure = await page.evaluate(() => {
      const pxToMm = (px) => (px * 25.4) / 96;
      const container = document.querySelector('.container');
      const table = document.querySelector('table.main-table');
      return {
        containerHeightMm: container ? Math.round(pxToMm(container.getBoundingClientRect().height) * 10) / 10 : null,
        tableTopMm: table ? Math.round(pxToMm(table.getBoundingClientRect().top + window.scrollY) * 10) / 10 : null,
        bodyHeightMm: Math.round(pxToMm(document.body.scrollHeight) * 10) / 10,
      };
    });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log(rel, JSON.stringify(measure), 'pdfPages=', pdfDoc.getPageCount());
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
