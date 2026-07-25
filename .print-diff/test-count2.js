const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const { PDFParse } = require('pdf-parse');

const src = esbuild.buildSync({
  entryPoints: [path.resolve('../apps/web/src/utils/printUtils.ts')],
  bundle: true, write: false, format: 'cjs',
}).outputFiles[0].text;

const combinedViaBrowser = async (page, pages) => page.evaluate(({ pages, src }) => {
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
}, { pages, src });

(async () => {
  const cases = [
    ['2 docs', ['使用急症室留院記錄', '使用約束措施的評估及同意書P1']],
    ['3 docs', ['使用急症室留院記錄', '使用約束措施的評估及同意書P1', '使用約束措施的評估及同意書P2']],
    ['4 docs', ['使用急症室留院記錄', '使用約束措施的評估及同意書P1', '使用約束措施的評估及同意書P2', '使用約束物品紀錄']],
    ['5 docs', ['使用急症室留院記錄', '使用約束措施的評估及同意書P1', '使用約束措施的評估及同意書P2', '使用約束物品紀錄', '個人意外事件記錄表']],
  ];
  const tpl = (n) => fs.readFileSync(path.resolve('../doc_html', n + '.html'), 'utf8');
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const ctx = await b.newContext();
  for (const [label, names] of cases) {
    const p1 = await ctx.newPage();
    await p1.goto('about:blank');
    const html = await combinedViaBrowser(p1, names.map(tpl));
    await p1.close();
    const p = await ctx.newPage();
    await p.setContent(html);
    await p.waitForTimeout(400);
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    await p.close();
    const parser = new PDFParse({ data: pdf });
    const res = await parser.getText();
    console.log(`${label}: ${res.pages.length} pages`);
    await parser.destroy();
  }
  await b.close();
})();
