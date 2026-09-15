// 追蹤 fixed 負 top 嘅幽靈 logo：兩頁文件、唔同 img 位置/層級
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOGO_SRC = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../apps/web/public/sc-logo.png')).toString('base64')}`;
const pt2mm = (pt) => (pt * 25.4) / 72;
function matMul(m, n) {
  const [a1, b1, c1, d1, e1, f1] = m; const [a2, b2, c2, d2, e2, f2] = n;
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}
const applyM = (m, x, y) => { const [a, b, c, d, e, f] = m; return [a * x + c * y + e, b * x + d * y + f]; };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const logoRects = async (buf) => {
    const d = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const out = [];
    for (let p = 1; p <= d.numPages; p++) {
      const pg = await d.getPage(p);
      const vp = pg.getViewport({ scale: 1 });
      const ops = await pg.getOperatorList();
      const stack = []; let ctm = [1, 0, 0, 1, 0, 0]; const rects = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() || ctm;
        else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
        else if (fn === OPS.paintImageXObject) {
          const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
          const w = pt2mm(Math.abs(pts[1][0] - pts[0][0]));
          if (w > 25 && w < 40) rects.push({ top: +pt2mm(vp.height - Math.max(...pts.map((q) => q[1]))).toFixed(1), left: +pt2mm(Math.min(...pts.map((q) => q[0]))).toFixed(1) });
        }
      }
      out.push(rects);
    }
    return out;
  };

  const run = async (name, bodyHtml) => {
    const page = await (await browser.newContext()).newPage();
    await page.setContent(`<!DOCTYPE html><html><head><style>
      @page { size: A4; margin: 5mm; }
      html, body { margin: 0; padding: 0; }
      .doc { height: 400mm; }
    </style></head><body>${bodyHtml}</body></html>`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await page.close();
    const rects = await logoRects(pdf);
    console.log(name, 'pages =', rects.length);
    rects.forEach((r, i) => console.log(`  page ${i + 1}:`, JSON.stringify(r)));
  };

  const img = (extra) => `<img src="${LOGO_SRC}" style="position:fixed;top:-3mm;right:-1.35mm;width:32mm;${extra || ''}">`;

  await run('D1 img 喺內容之前（同 B）:', `${img()}<div class="doc">content</div>`);
  await run('D2 img 喺內容之後:', `<div class="doc">content</div>${img()}`);
  await run('D3 img 包喺 div 入面:', `<div>${img()}</div><div class="doc">content</div>`);
  await run('D4 三頁文件:', `${img()}<div class="doc" style="height:700mm">content</div>`);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
