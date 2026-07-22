const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const p = await (await b.newContext()).newPage();
  await p.goto('file:///' + path.resolve('shots/_all.combined.html').replace(/\\/g, '/'));
  await p.waitForTimeout(600);
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync('shots/_all.pdf', pdf);
  const parser = new PDFParse({ data: pdf });
  const info = await parser.getInfo();
  console.log('ALL combined real pages:', info.total);
  await parser.destroy();
  await b.close();
})();
