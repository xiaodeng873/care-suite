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
  const names = JSON.parse(fs.readFileSync('cases-list.json', 'utf8'));
  const tpl = (n) => fs.readFileSync(path.resolve('../doc_html', n + '.html'), 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  const run = async (label, subset) => {
    const pages = subset.map(tpl);
    const combined = await combinedViaBrowser((await ctx.newPage()), pages);
    const p = await ctx.newPage();
    await p.setContent(combined);
    await p.waitForTimeout(500);
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    await p.close();
    const parser = new PDFParse({ data: pdf });
    const res = await parser.getText();
    console.log(`${label} (${subset.length} docs): ${res.pages.length} pages`);
    await parser.destroy();
  };
  await run('first 10', names.slice(0, 10));
  await run('first 20', names.slice(0, 20));
  await run('first 30', names.slice(0, 30));
  await run('all', names);
  await browser.close();
})();
