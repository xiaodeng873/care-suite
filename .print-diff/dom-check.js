const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const p = await (await b.newContext()).newPage();
  const html = fs.readFileSync(path.resolve('shots/_all.combined.html'), 'utf8');
  // 從 _all.combined.html 抽出 候診 + 血糖 兩份？
  // 直接用 bisect 生成的：重新生成 [候診, 血糖]
  const esbuild = require('esbuild');
  const build = esbuild.buildSync({
    entryPoints: [path.resolve('../apps/web/src/utils/printUtils.ts')],
    bundle: true, write: false, format: 'cjs',
  });
  const src = build.outputFiles[0].text;
  const tpl = (n) => fs.readFileSync(path.resolve('../doc_html', n + '.html'), 'utf8');
  const combined = await p.evaluate(({ pages, src }) => {
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', src)(mod, mod.exports, () => ({}));
    let captured = '';
    const origCreate = document.createElement.bind(document);
    const fakeDoc = { open() {}, close() {}, write(s) { captured = s; } };
    document.createElement = (tag) => tag === 'iframe'
      ? { id: '', style: { cssText: '' }, contentWindow: { document: fakeDoc, focus() {}, print() {} } }
      : origCreate(tag);
    document.body.appendChild = () => {};
    document.getElementById = () => null;
    mod.exports.printCombinedHtml(pages, 'test-frame');
    return captured;
  }, { pages: [tpl('院友候診記錄表'), tpl('院友血糖記錄')], src });
  await p.setContent(combined);
  await p.waitForTimeout(400);
  const info = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('[class*="print-doc-"]').forEach((w) => {
      out.push({
        cls: w.className,
        scrollH: w.scrollHeight,
        rows: w.querySelectorAll('tr').length,
        text: w.textContent.replace(/\s+/g, ' ').slice(0, 30),
      });
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
