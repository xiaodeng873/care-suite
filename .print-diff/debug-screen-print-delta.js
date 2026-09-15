// 診斷：邊個因素令 print 標題字頂比 screen 低 ~0.9mm
// 逐層加返範本特徵：flex body / a4-page 210mm / line-height normal / 標楷體 / no-print / @media print width:100%
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pt2mm = (pt) => (pt * 25.4) / 72;

const CASES = {
  plain: `<body style="margin:0"><h1 style="margin:0;font-size:26px;font-family:'DFKai-SB','標楷體',serif">善頤(福群)護老院</h1></body>`,
  flex_a4: `<body style="margin:0;display:flex;justify-content:center"><div class="a4-page" style="width:210mm;min-height:297mm;display:flex;flex-direction:column"><h1 style="margin:0;font-size:26px;font-family:'DFKai-SB','標楷體',serif">善頤(福群)護老院</h1></div></body>`,
  print_css: `<style>@page{size:A4;margin:5mm 0.25in}@media print{.a4-page{width:100%;min-height:287mm}}</style><body style="margin:0;display:flex;justify-content:center"><div class="a4-page" style="width:210mm;min-height:297mm;display:flex;flex-direction:column"><h1 style="margin:0;font-size:26px;font-family:'DFKai-SB','標楷體',serif">善頤(福群)護老院</h1></div></body>`,
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  for (const [name, inner] of Object.entries(CASES)) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${inner.includes('<style>') ? '' : '<style>@page{size:A4;margin:5mm 0.25in}</style>'}${inner}</html>`;
    const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    // screen 量度
    const screen = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const r = document.createRange();
      r.setStart(h1.firstChild, 0); r.setEnd(h1.firstChild, 1);
      const rr = r.getBoundingClientRect();
      return { rangeTopPx: rr.top, rangeHPx: rr.height, lh: getComputedStyle(h1).lineHeight };
    });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
    const p = await doc.getPage(1);
    const pageH = p.getViewport({ scale: 1 }).height;
    const tc = await p.getTextContent();
    const t = tc.items.find((it) => (it.str || '').trim().startsWith('善'));
    const fsPt = Math.hypot(t.transform[1], t.transform[3]);
    const baselineFromTopMm = pt2mm(pageH - t.transform[5]);
    console.log(`${name}: screen rangeTop=${screen.rangeTopPx.toFixed(2)}px lh=${screen.lh} | print baseline=${baselineFromTopMm.toFixed(2)}mm fs=${pt2mm(fsPt).toFixed(2)}mm glyphTop(0.72em)=${(baselineFromTopMm - pt2mm(0.72 * fsPt)).toFixed(2)}mm`);
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
