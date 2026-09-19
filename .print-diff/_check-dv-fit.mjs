import { chromium } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const html = fs.readFileSync('../upload/doc_html/醫生診治記錄.html', 'utf-8');
const browser = await chromium.launch({ executablePath: CHROME });
const page = await (await browser.newContext()).newPage();
await page.setContent(html, { waitUntil: 'load' });
const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
const doc = await PDFDocument.load(pdfBuf);
console.log('醫生診治記錄 pages:', doc.getPageCount());
// footer（頁碼 14 / B2 FK）係咪同表格同一頁：搵含 'B2' text 嘅頁
await browser.close();
