// 驗證兩個定位假設（以紙張邊緣計嘅統一 logo 位）：
// A) body 級 absolute（無 positioned ancestor）：top 用紙張座標 k×紙高+2mm，會唔會落喺第 k+1 頁頂部 2mm？
// B) fixed + 負 top（伸入 @page 上邊界）：margin:5mm 文件 top:-3mm，會唔會每頁都喺紙頂 2mm？
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
          if (w > 25 && w < 40) rects.push({ top: pt2mm(vp.height - Math.max(...pts.map((q) => q[1]))), left: pt2mm(Math.min(...pts.map((q) => q[0]))) });
        }
      }
      out.push(rects);
    }
    return out;
  };
  const imgTag = (style) => `<img src="${LOGO_SRC}" style="${style}">`;

  // A) body 級 absolute，紙張座標（root @page margin:0；內容文件 named page margin:5mm）
  const pageA = await (await browser.newContext()).newPage();
  await pageA.setContent(`<!DOCTYPE html><html><head><style>
    @page { size: A4; margin: 0; }
    @page pg { size: A4; margin: 5mm; }
    html, body { margin: 0; padding: 0; }
    .doc { page: pg; height: 400mm; }
  </style></head><body>
    ${imgTag('position:absolute;top:2mm;right:2mm;width:32mm;')}
    ${imgTag('position:absolute;top:299mm;right:2mm;width:32mm;')}
    <div class="doc">content</div>
  </body></html>`, { waitUntil: 'load' });
  await pageA.evaluate(() => document.fonts.ready);
  const pdfA = await pageA.pdf({ preferCSSPageSize: true, printBackground: true });
  await pageA.close();
  const rectsA = await logoRects(pdfA);
  console.log('A) body 級 absolute 紙張座標：pages =', rectsA.length);
  rectsA.forEach((r, i) => console.log(`  page ${i + 1}:`, JSON.stringify(r), '(expect [{top:~2, left:~176}])'));

  // B) fixed 負 top 伸入邊界（單一文件 @page margin:5mm，兩頁）
  const pageB = await (await browser.newContext()).newPage();
  await pageB.setContent(`<!DOCTYPE html><html><head><style>
    @page { size: A4; margin: 5mm; }
    html, body { margin: 0; padding: 0; }
    .doc { height: 400mm; }
  </style></head><body>
    ${imgTag('position:fixed;top:-3mm;right:-3mm;width:32mm;z-index:999;')}
    <div class="doc">content</div>
  </body></html>`, { waitUntil: 'load' });
  await pageB.evaluate(() => document.fonts.ready);
  const pdfB = await pageB.pdf({ preferCSSPageSize: true, printBackground: true });
  await pageB.close();
  const rectsB = await logoRects(pdfB);
  console.log('B) fixed top:-3mm（margin 5mm）：pages =', rectsB.length);
  rectsB.forEach((r, i) => console.log(`  page ${i + 1}:`, JSON.stringify(r), '(expect [{top:~2, left:~173.8}])'));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
