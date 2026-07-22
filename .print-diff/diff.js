/* 對比工具 v2：用真實的 printUtils.ts + cssScope.ts（esbuild 編譯）
 * 1. 每個範本：orig 截圖 vs scoped 截圖 + PDF 頁數
 * 2. 全部範本合併成一份（模擬 printCombinedHtml），截圖檢查樣式污染
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 用 esbuild 把真實 printUtils.ts 編成 cjs
const build = esbuild.buildSync({
  entryPoints: [path.resolve('../apps/web/src/utils/printUtils.ts')],
  bundle: true,
  write: false,
  format: 'cjs',
});
const mod = { exports: {} };
new Function('module', 'exports', 'require', build.outputFiles[0].text)(mod, mod.exports, require);
const { printCombinedHtml } = mod.exports;

// 在 node 端重現 printCombinedHtml 的合併邏輯（不碰 DOM）：
// 直接從編譯後的 scopeDocumentHtml 邏輯重組 —— 用 jsdom 太重，改為在瀏覽器頁面裡執行真實函數。
const combinedViaBrowser = async (page, pages) => {
  return await page.evaluate(({ pages, src }) => {
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', src)(mod, mod.exports, (m) => ({}));
    let captured = '';
    // 攔截 document.createElement('iframe') 的 doc.write
    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'iframe') {
        Object.defineProperty(el, 'contentWindow', { value: null });
      }
      return el;
    };
    // 直接複製 printCombinedHtml 的合併部分：scopeDocumentHtml 沒有 export，
    // 所以改用攔截 doc.write —— 但 contentWindow 為 null 會 return。
    // 改為：提供一個 fake document。
    const fakeDoc = {
      open() {}, close() {},
      write(s) { captured = s; },
    };
    document.createElement = (tag) => {
      if (tag === 'iframe') {
        return { id: '', style: { cssText: '' }, contentWindow: { document: fakeDoc, focus() {}, print() {} } };
      }
      return origCreate(tag);
    };
    document.body.appendChild = () => {};
    document.getElementById = () => null;
    mod.exports.printCombinedHtml(pages, 'test-frame');
    return captured;
  }, { pages, src: build.outputFiles[0].text });
};

(async () => {
  const tplDir = path.resolve('../doc_html');
  const files = fs.readdirSync(tplDir).filter((f) => f.endsWith('.html')).map((f) => path.join(tplDir, f));
  const only = process.argv.slice(2);
  const targets = only.length ? files.filter((f) => only.some((o) => f.includes(o))) : files;

  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  fs.mkdirSync('shots', { recursive: true });

  // 1) 全部合併（模擬 bundle 列印順序）
  const allPages = targets.map((f) => fs.readFileSync(f, 'utf8'));
  const boot = await ctx.newPage();
  await boot.goto('about:blank');
  const combined = await combinedViaBrowser(boot, allPages);
  fs.writeFileSync('shots/_all.combined.html', combined);
  await boot.close();

  const errors = [];
  const watch = (page, tag) => {
    page.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] CONSOLE: ${m.text()}`); });
  };

  // 2) 逐份對比
  for (const f of targets) {
    const name = path.basename(f, '.html');
    const page = await ctx.newPage();
    watch(page, name);
    await page.emulateMedia({ media: 'print' });

    await page.goto('file:///' + f.replace(/\\/g, '/'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `shots/${name}.orig.png`, fullPage: true });
    const pdf1 = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pages1 = (pdf1.toString('binary').match(/\/Type\s*\/Page[^s]/g) || []).length;

    const single = await combinedViaBrowser(page, [fs.readFileSync(f, 'utf8')]);
    fs.writeFileSync(`shots/${name}.combined.html`, single);
    await page.goto('file:///' + path.resolve(`shots/${name}.combined.html`).replace(/\\/g, '/'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `shots/${name}.scoped.png`, fullPage: true });
    const pdf2 = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pages2 = (pdf2.toString('binary').match(/\/Type\s*\/Page[^s]/g) || []).length;

    console.log(`${name}: orig ${pages1}p scoped ${pages2}p ${pages1 === pages2 ? 'OK' : '*** MISMATCH ***'}`);
    await page.close();
  }

  // 3) 全部合併的 PDF 頁數
  const all = await ctx.newPage();
  watch(all, 'ALL');
  await all.goto('file:///' + path.resolve('shots/_all.combined.html').replace(/\\/g, '/'));
  await all.waitForTimeout(500);
  await all.screenshot({ path: 'shots/_all.scoped.png', fullPage: true });
  const pdfAll = await all.pdf({ preferCSSPageSize: true, printBackground: true });
  const pagesAll = (pdfAll.toString('binary').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`ALL combined: ${pagesAll} pages`);
  await all.close();

  if (errors.length) {
    console.log('\n--- SCRIPT ERRORS ---');
    [...new Set(errors)].forEach((e) => console.log(e));
  } else {
    console.log('\nNo script errors.');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
