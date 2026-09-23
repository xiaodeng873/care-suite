// 用 pdfjs-dist v5 (ESM) + @napi-rs/canvas 將 PDF 指定頁 rasterize 做 PNG
const path = require('path');
const fs = require('fs');
const { createCanvas, DOMMatrix, DOMPoint, ImageData, Path2D } = require('@napi-rs/canvas');
globalThis.DOMMatrix = globalThis.DOMMatrix || DOMMatrix;
globalThis.DOMPoint = globalThis.DOMPoint || DOMPoint;
globalThis.ImageData = globalThis.ImageData || ImageData;
globalThis.Path2D = globalThis.Path2D || Path2D;

(async () => {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const file = process.argv[2];
  const pages = process.argv.slice(3).map(Number); // 1-based；空 = 全部
  const data = new Uint8Array(fs.readFileSync(path.resolve(__dirname, file)));
  const canvasFactory = {
    create(w, h) {
      const canvas = createCanvas(Math.ceil(w), Math.ceil(h));
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(pair, w, h) { pair.canvas.width = Math.ceil(w); pair.canvas.height = Math.ceil(h); },
    destroy(pair) { pair.canvas = null; },
  };
  const doc = await pdfjs.getDocument({ data, canvasFactory }).promise;
  console.log('total pages:', doc.numPages);
  const targets = pages.length ? pages : Array.from({ length: doc.numPages }, (_, i) => i + 1);
  for (const p of targets) {
    if (p < 1 || p > doc.numPages) continue;
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.4 });
    const pair = canvasFactory.create(viewport.width, viewport.height);
    await page.render({ canvasContext: pair.context, viewport, canvasFactory }).promise;
    const out = path.resolve(__dirname, `${path.basename(file, '.pdf')}-page${p}.png`);
    fs.writeFileSync(out, pair.canvas.toBuffer('image/png'));
    console.log('page', p, '->', path.basename(out));
  }
})();
