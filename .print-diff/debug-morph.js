const { chromium } = require('playwright-core');
const { PDFDocument } = require('pdf-lib');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const wrap = (inner) => `<div style="padding: 5mm 6.35mm; box-sizing: border-box;">${inner}</div>`;
const doc = (css, inner) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;}@page{size:A4 portrait;margin:0;}</style><style>${css}</style></head><body>${wrap(inner)}</body></html>`;

const baseCss = `
  .p { min-height: 287mm; display:flex; flex-direction:column; box-sizing: border-box; }
  .a { height: 99px; flex-shrink: 0; }
  .b { flex-grow: 1; overflow: hidden; }
  .c { height: 34px; flex-shrink: 0; margin-top: auto; }
`;

const tableHtml = `<table style="width:100%; border-collapse:collapse; table-layout:fixed; border:1.5px solid black;"><thead><tr><th style="border:1px solid black; height:28px; font-size:14px;">H</th></tr></thead><tbody>${Array(34).fill('<tr style="height:25.5px;"><td style="border:1px solid black; padding:0; font-size:14px;">x</td></tr>').join('')}</tbody></table>`;

(async () => {
  const variants = {
    'flex-grow div 900px': baseCss + '',
    'table in flex-grow': baseCss,
  };
  const inners = {
    'flex-grow div 900px': `<div class="p"><div class="a"></div><div class="b"><div style="height:890px"></div></div><div class="c"></div></div>`,
    'table in flex-grow': `<div class="p"><div class="a"></div><div class="b">${tableHtml}</div><div class="c"></div></div>`,
  };
  const browser = await chromium.launch({ executablePath: CHROME });
  for (const [name] of Object.entries(variants)) {
    const page = await (await browser.newContext()).newPage();
    await page.setContent(doc(baseCss, inners[name]), { waitUntil: 'load' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log(name, 'pdfPages=', pdfDoc.getPageCount());
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
