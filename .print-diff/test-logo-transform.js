// C) absolute + transform translateY/X：layout 位喺內容盒內（fragment 安全），
//    用 transform 視覺移入邊界區 → 期望每頁 logo 都喺紙頂 2mm
// D) fixed 負 top 單頁文件：調查 B 嘅 page1 底部幽靈 logo 係咪常設
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

  // C) 兩頁文件 margin:5mm；relative 容器入面兩個 absolute logo（k=0,1），transform 上移 4mm 入邊界
  const pageC = await (await browser.newContext()).newPage();
  await pageC.setContent(`<!DOCTYPE html><html><head><style>
    @page { size: A4; margin: 5mm; }
    html, body { margin: 0; padding: 0; }
    .doc { position: relative; height: 400mm; }
  </style></head><body>
    <div class="doc">content
      <img src="${LOGO_SRC}" style="position:absolute;top:1mm;right:1mm;width:32mm;transform:translate(4mm,-4mm);">
      <img src="${LOGO_SRC}" style="position:absolute;top:288mm;right:1mm;width:32mm;transform:translate(4mm,-4mm);">
    </div>
  </body></html>`, { waitUntil: 'load' });
  await pageC.evaluate(() => document.fonts.ready);
  const pdfC = await pageC.pdf({ preferCSSPageSize: true, printBackground: true });
  await pageC.close();
  const rectsC = await logoRects(pdfC);
  console.log('C) absolute+transform：pages =', rectsC.length);
  rectsC.forEach((r, i) => console.log(`  page ${i + 1}:`, JSON.stringify(r), '(expect [{top:~2, left:~176}])'));

  // D) fixed 負 top，單頁文件
  const pageD = await (await browser.newContext()).newPage();
  await pageD.setContent(`<!DOCTYPE html><html><head><style>
    @page { size: A4; margin: 5mm; }
    html, body { margin: 0; padding: 0; }
    .doc { height: 100mm; }
  </style></head><body>
    <img src="${LOGO_SRC}" style="position:fixed;top:-3mm;right:-1.35mm;width:32mm;">
    <div class="doc">content</div>
  </body></html>`, { waitUntil: 'load' });
  await pageD.evaluate(() => document.fonts.ready);
  const pdfD = await pageD.pdf({ preferCSSPageSize: true, printBackground: true });
  await pageD.close();
  const rectsD = await logoRects(pdfD);
  console.log('D) fixed 負 top 單頁：pages =', rectsD.length);
  rectsD.forEach((r, i) => console.log(`  page ${i + 1}:`, JSON.stringify(r), '(expect 一個 @~2mm，睇下有冇幽靈)'));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
