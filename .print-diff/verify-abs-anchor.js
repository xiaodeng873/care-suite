// 驗證：合併文件入面 position:absolute logo 係咪錨定喺「自己嗰頁」嘅頂部，
// 定係好似 fixed 咁每頁重複。
// A/B 兩份文件（各一頁），各帶一個 absolute logo top:2mm；預期：每頁各一個 logo，位置喺該頁頂部。
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pt2mm = (pt) => (pt * 25.4) / 72;
function matMul(m, n) {
  const [a1, b1, c1, d1, e1, f1] = m; const [a2, b2, c2, d2, e2, f2] = n;
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}
const applyM = (m, x, y) => { const [a, b, c, d, e, f] = m; return [a * x + c * y + e, b * x + d * y + f]; };

const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: A4; margin: 5mm; }
body { margin: 0; }
.doc { page-break-after: always; position: relative; }
.logo { position: absolute; top: 2mm; right: 2mm; width: 32mm; height: 8mm; }
h1 { margin: 0; font-size: 26px; }
</style></head><body>
<div class="doc"><img class="logo" src="${IMG}"><h1>文件A標題</h1><p>內容A</p></div>
<div class="doc"><img class="logo" src="${IMG}"><h1>文件B標題</h1><p>內容B</p></div>
</body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(HTML, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4' });
  await browser.close();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  console.log('pages=', doc.numPages);
  for (let p = 1; p <= doc.numPages; p++) {
    const pdfPage = await doc.getPage(p);
    const vp = pdfPage.getViewport({ scale: 1 });
    const ops = await pdfPage.getOperatorList();
    const stack = []; let ctm = [1, 0, 0, 1, 0, 0]; const rects = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() || ctm;
      else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
      else if (fn === OPS.paintImageXObject) {
        const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
        rects.push({ topMm: pt2mm(vp.height - Math.max(...pts.map((q) => q[1]))).toFixed(2) });
      }
    }
    console.log(`page ${p}: imgs=${rects.length}`, JSON.stringify(rects));
  }
})().catch((e) => { console.error(e); process.exit(1); });
