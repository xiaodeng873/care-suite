// 提取 PDF 每頁文字位置，量度「善頤」院舍名稱距離每頁頂部嘅距離 (pt, 1pt=0.3528mm)
const fs = require('fs');
const path = require('path');

(async () => {
  globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
  const pdfjsPath = 'file:///' + path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.mjs').replace(/\\/g, '/');
  const pdfjs = await import(pdfjsPath);
  const data = new Uint8Array(fs.readFileSync(path.join(__dirname, 'vacc-test.pdf')));
  const doc = await pdfjs.getDocument({ data }).promise;
  console.log('pages:', doc.numPages);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    // 搵院舍名（包含 善 / 頤 / 護老院 嘅大字）同頁碼
    let titleTop = null;
    let lowest = 0;
    for (const item of tc.items) {
      const y = item.transform[5]; // baseline y (PDF 座標由下往上)
      lowest = Math.max(lowest, y);
      const str = item.str || '';
      if (/善.*頤|護老院/.test(str) && (titleTop === null || y > titleTop)) {
        if (titleTop === null) titleTop = y;
      }
    }
    const topMm = titleTop !== null ? ((vp.height - titleTop) * 0.3528).toFixed(1) : 'N/A';
    console.log(`page ${i}: pageH=${vp.height.toFixed(1)}pt 院舍名距頂=${topMm}mm 最高文字baseline距頂=${((vp.height - lowest) * 0.3528).toFixed(1)}mm (注: baseline, 字形頂約再高3-4mm)`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
