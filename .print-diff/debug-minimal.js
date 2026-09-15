const { chromium } = require('playwright-core');
const { PDFDocument } = require('pdf-lib');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const pageCss = (mh, flex) => `
  .p { min-height: ${mh}mm; ${flex ? 'display:flex; flex-direction:column;' : ''} box-sizing: border-box; }
  .a { height: 100px; background: #eee; }
  .b { height: 900px; background: #ddd; }
  .c { height: 34px; background: #ccc; }
`;

const inner = '<div class="p"><div class="a"></div><div class="b"></div><div class="c"></div></div>';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const variants = {
    'flex min-height 287 + padding wrapper': { css: pageCss(287, true), wrap: 'padding: 5mm 6.35mm; box-sizing: border-box;' },
    'flex min-height 280 + padding wrapper': { css: pageCss(280, true), wrap: 'padding: 5mm 6.35mm; box-sizing: border-box;' },
    'flex min-height 200 + padding wrapper': { css: pageCss(200, true), wrap: 'padding: 5mm 6.35mm; box-sizing: border-box;' },
    'no-flex min-height 287 + padding wrapper': { css: pageCss(287, false), wrap: 'padding: 5mm 6.35mm; box-sizing: border-box;' },
    'flex 無min-height + padding wrapper': { css: pageCss(0, true).replace('min-height: 0mm;', ''), wrap: 'padding: 5mm 6.35mm; box-sizing: border-box;' },
    'flex min-height 287 無wrapper': { css: pageCss(287, true), wrap: null },
  };
  for (const [name, v] of Object.entries(variants)) {
    const wrapHtml = v.wrap
      ? `<div style="${v.wrap}">${inner}</div>`
      : inner;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;}@page{size:A4 portrait;margin:0;}</style><style>${v.css}</style></head><body>${wrapHtml}</body></html>`;
    const page = await (await browser.newContext()).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log(name, 'pdfPages=', pdfDoc.getPageCount());
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
