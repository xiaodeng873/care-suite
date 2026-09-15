// debug：dump 一頁只含 logo 嘅 PDF 嘅 operator list，睇影像用咩 op 畫
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  const b64 = fs.readFileSync('../apps/web/public/sc-logo.png').toString('base64');
  await page.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${b64}" style="position:fixed;top:5mm;right:2mm;width:32mm"></body></html>`);
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  console.log('paint/cm ops:', Object.keys(OPS).filter(k => /paint|^cm$|transform/i.test(k)).map(k => `${k}=${OPS[k]}`).join(', '));
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  const p = await doc.getPage(1);
  const ops = await p.getOperatorList();
  const counts = {};
  ops.fnArray.forEach((f) => { const name = Object.keys(OPS).find((k) => OPS[k] === f); counts[name || f] = (counts[name || f] || 0) + 1; });
  console.log(JSON.stringify(counts));
  // 印出全部 op 序列（簡寫）
  const seq = ops.fnArray.map((f) => Object.keys(OPS).find((k) => OPS[k] === f) || f).join(' ');
  console.log(seq);
})().catch((e) => { console.error(e); process.exit(1); });
