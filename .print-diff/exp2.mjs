import { chromium } from 'playwright-core';
import fs from 'fs';

const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';
const browser = await chromium.launch({ headless: true });

// 實驗 2：relative + top:-15mm（模擬背面移位，唔加載體、唔移除 fixed）
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const w = document.querySelector('.print-doc-0-4');
  const containers = w.querySelectorAll('.container');
  containers.forEach((c, i) => {
    c.style.position = 'relative';
    if (i % 2 === 1) c.style.top = '-15mm';
  });
});
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: 'C:/Users/Admin/Desktop/care-suite/.print-diff/exp2-top.pdf', preferCSSPageSize: true, printBackground: true });
await page.close();

// 實驗 3：relative + 加入零尺寸 absolute carrier div（唔移位）
const page2 = await browser.newPage();
await page2.setViewportSize({ width: 1200, height: 800 });
await page2.goto('file:///' + htmlPath, { waitUntil: 'networkidle' });
await page2.evaluate(() => {
  const w = document.querySelector('.print-doc-0-4');
  const containers = w.querySelectorAll('.container');
  containers.forEach((c) => {
    c.style.position = 'relative';
    const carrier = document.createElement('div');
    carrier.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;';
    c.appendChild(carrier);
  });
});
await page2.emulateMedia({ media: 'print' });
await page2.pdf({ path: 'C:/Users/Admin/Desktop/care-suite/.print-diff/exp3-carrier.pdf', preferCSSPageSize: true, printBackground: true });
await page2.close();
await browser.close();

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = await import('@napi-rs/canvas');
for (const name of ['exp2-top', 'exp3-carrier']) {
  const data = new Uint8Array(fs.readFileSync(`C:/Users/Admin/Desktop/care-suite/.print-diff/${name}.pdf`));
  const doc = await pdfjs.getDocument({ data }).promise;
  const p = await doc.getPage(7);
  const vp = p.getViewport({ scale: 1.2 });
  const canvas = createCanvas(vp.width, vp.height);
  await p.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  fs.writeFileSync(`C:/Users/Admin/Desktop/care-suite/.print-diff/${name}-p7.png`, canvas.toBuffer('image/png'));
}
console.log('done');
