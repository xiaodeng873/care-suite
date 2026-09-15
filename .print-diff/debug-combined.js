// debug：screen layout 檢查合併文件 wrapper/img 位置
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const extractBody = (html) => html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? '';
(async () => {
  const docs = ['院友護理評估記錄.html', '院友體溫記錄.html', '院友外出同意書.html']
    .map((f) => fs.readFileSync(path.join(root, 'upload/doc_html', f), 'utf8'));
  const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
html, body { margin: 0; padding: 0; }
[class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
</style></head><body>
<img class="admission-page-logo" src="x" style="position:absolute;top:1mm;right:2mm;width:32mm;height:10mm;background:red">
${docs.map((d, i) => `<div class="print-doc-0-${i}" style="position:relative;">${extractBody(d)}</div>`).join('\n')}
</body></html>`;
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
  await page.setContent(combined, { waitUntil: 'load' });
  const m = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[class*="print-doc-"]').forEach((w) => {
      const r = w.getBoundingClientRect();
      out.push({ cls: w.className, pos: getComputedStyle(w).position, top: Math.round(r.top), h: Math.round(r.height), children: w.children.length });
    });
    return { wrappers: out, bodyChildren: Array.from(document.body.children).map((c) => c.tagName + '.' + c.className) };
  });
  console.log(JSON.stringify(m, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
