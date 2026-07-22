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
  const cases = require('./cases.js');
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  for (const names of cases) {
    const tag = names.length + 'docs';
    const boot = await ctx.newPage();
    await boot.goto('about:blank');
    const html = await combinedViaBrowser(boot, names.map(tpl));
    await boot.close();
    const p = await ctx.newPage();
    await p.setContent(html);
    await p.waitForTimeout(400);
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    const parser = new PDFParse({ data: pdf });
    const res = await parser.getText();
    console.log(`\n== [${names.join(' | ')}]: ${res.pages.length} pages`);
    res.pages.forEach((pg, i) => console.log(`  p${i + 1}: ${(pg.text || '').replace(/\s+/g, ' ').trim().slice(0, 40)}`));
    await parser.destroy();
    await p.close();
  }
  await browser.close();
})();
