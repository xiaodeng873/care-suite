// 驗證：JhengHei 13pt（intake 用字體）screen range top vs print glyph top 嘅 delta
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pt2mm = (pt) => (pt * 25.4) / 72;
const CASES = {
  jhenghei13: { fs: '13pt', fam: `'Microsoft JhengHei','微軟正黑體',sans-serif` },
  jhenghei_13px_lh115: { fs: '13px', fam: `'Microsoft JhengHei','微軟正黑體',sans-serif`, lh: '1.15' },
  dfkai_lh11: { fs: '26px', fam: `'DFKai-SB','標楷體',serif`, lh: '1.1' },
  dfkai_lh155: { fs: '26px', fam: `'DFKai-SB','標楷體',serif`, lh: '1.55' },
};
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  for (const [name, c] of Object.entries(CASES)) {
    const lhStyle = c.lh ? `line-height:${c.lh};` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:A4;margin:5mm}</style></head><body style="margin:0"><h1 style="margin:0;font-size:${c.fs};font-family:${c.fam};${lhStyle}">善頤(福群)護老院</h1></body></html>`;
    const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const screen = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const r = document.createRange();
      r.setStart(h1.firstChild, 0); r.setEnd(h1.firstChild, 1);
      const rr = r.getBoundingClientRect();
      return { rangeTopPx: rr.top, lh: getComputedStyle(h1).lineHeight, lhPx: h1.getBoundingClientRect().height };
    });
    const pdfBuf = await page.pdf({ format: 'A4' });
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
    const p = await doc.getPage(1);
    const pageH = p.getViewport({ scale: 1 }).height;
    const tc = await p.getTextContent();
    const t = tc.items.find((it) => (it.str || '').trim().startsWith('善'));
    const fsPt = Math.hypot(t.transform[1], t.transform[3]);
    const baselineRelMm = pt2mm(pageH - t.transform[5]) - 5;
    // 用 0.72em(DFKai)/0.88em(JhengHei) 估算 print glyph top rel origin
    const emFactor = c.fam.includes('DFKai') ? 0.72 : 0.88;
    const glyphRelMm = baselineRelMm - pt2mm(emFactor * fsPt);
    const screenRelMm = screen.rangeTopPx * 25.4 / 96;
    console.log(`${name}: screen=${screenRelMm.toFixed(2)}mm lh=${screen.lh}(h1h=${screen.lhPx.toFixed(1)}px) | print baseline rel=${baselineRelMm.toFixed(2)}mm glyphTopRel≈${glyphRelMm.toFixed(2)}mm | delta=${(glyphRelMm - screenRelMm).toFixed(2)}mm`);
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
