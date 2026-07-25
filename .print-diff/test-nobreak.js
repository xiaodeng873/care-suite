const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const { PDFParse } = require('pdf-parse');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const build = esbuild.buildSync({
  entryPoints: [path.resolve('../apps/web/src/utils/printUtils.ts')],
  bundle: true, write: false, format: 'cjs',
});
const src = build.outputFiles[0].text;

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
  const tpl = (n) => fs.readFileSync(path.resolve('../doc_html', n + '.html'), 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  const run = async (label, names, noBreakRule) => {
    const pages = names.map(tpl);
    const combined = await combinedViaBrowser((await ctx.newPage()), pages);
    if (noBreakRule) {
      // 移除全局 page-break-before，只靠 page name 切換
      const modified = combined.replace('[class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }', '');
      fs.writeFileSync('shots/_no-break.html', modified);
      const p = await ctx.newPage();
      await p.setContent(modified);
      await p.waitForTimeout(500);
      const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
      await p.close();
      const parser = new PDFParse({ data: pdf });
      const res = await parser.getText();
      console.log(`${label}: ${res.pages.length} pages`);
      await parser.destroy();
    } else {
      const p = await ctx.newPage();
      await p.setContent(combined);
      await p.waitForTimeout(500);
      const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
      await p.close();
      const parser = new PDFParse({ data: pdf });
      const res = await parser.getText();
      console.log(`${label}: ${res.pages.length} pages`);
      await parser.destroy();
    }
  };
  // 用有問題的全集
  const names = JSON.parse(fs.readFileSync('cases-list.json', 'utf8') || '[]');
  await run('ALL with break rule', names, false);
  await run('ALL no break rule', names, true);
  await browser.close();
})();
