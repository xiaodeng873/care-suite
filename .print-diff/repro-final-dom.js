// 復刻真實列印路徑：printGroupedHtml（duplex 補頁）→ 攞補頁後 DOM → print-to-PDF
// 後備：若 doPrint 6s 內未觸發（headless 時序問題），手動叫 padOddPageDocuments 再攞 DOM
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');

(async () => {
  const r = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printUtils.ts')],
    bundle: true, write: false, format: 'iife', platform: 'browser',
    globalName: 'PrintUtils',
    plugins: [{
      name: 'stubs',
      setup(build) {
        build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
      },
    }],
    define: { 'import.meta.env.BASE_URL': "'/'" },
  });
  const printUtilsJs = r.outputFiles[0].text;

  const pages = JSON.parse(fs.readFileSync(path.join(__dirname, 'bundle-pages.json'), 'utf8'));

  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('about:blank');
  await page.addScriptTag({ content: printUtilsJs });

  const finalHtml = await page.evaluate(async (pagesArr) => {
    const log = [];
    window.PrintUtils.printGroupedHtml(pagesArr, 'test-iframe', true);
    const iframe = document.getElementById('test-iframe');
    log.push('iframe immediate: ' + !!iframe + ', readyState: ' + (iframe && iframe.contentDocument && iframe.contentDocument.readyState));
    const win = iframe.contentWindow;
    win.print = () => { win.__printCalled = true; };

    const grabState = () => {
      const doc = iframe.contentDocument;
      const scope = doc.querySelector('.print-doc-0-16');
      const p1 = scope && scope.querySelector('.page-1');
      const inner = p1 && p1.querySelector('.a4-container');
      const spacers = doc.querySelectorAll('[class*="print-doc-blank-"]').length;
      return {
        readyState: doc.readyState,
        spacers,
        p1InlineHeight: p1 && p1.style.height || null,
        p1Transform: inner && inner.style.transform || null,
      };
    };

    // 等 doPrint 自己跑（最多 6s）
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      await new Promise((r) => setTimeout(r, 200));
      if (win.__printCalled) break;
    }
    log.push('after wait: printCalled=' + !!win.__printCalled + ' state=' + JSON.stringify(grabState()));

    // 後備：doPrint 未跑 → 手動補頁（同 printGroupedHtml 嘅參數邏輯）
    if (!win.__printCalled) {
      const PU = window.PrintUtils;
      const marginPageNames = new Map();
      const wrappers = pagesArr.map((pg, i) => {
        const cfg = PU.extractPageConfig(pg);
        const key = cfg.orientation + '|' + cfg.margin;
        let name = marginPageNames.get(key);
        if (!name) { name = 'pg-0-' + marginPageNames.size; marginPageNames.set(key, name); }
        return { selector: '.print-doc-0-' + i, config: cfg, pageName: name };
      });
      const doc = iframe.contentDocument;
      const allCss = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent).join('\n');
      try {
        PU.padOddPageDocuments(doc, wrappers, allCss, true);
        log.push('manual pad done, state=' + JSON.stringify(grabState()));
      } catch (e) {
        log.push('manual pad ERROR: ' + e.message);
      }
    }
    return { html: '<!DOCTYPE html>\n' + iframe.contentDocument.documentElement.outerHTML, log };
  }, pages);

  console.log(finalHtml.log.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'bundle-final-dom.html'), finalHtml.html);
  console.log('final DOM bytes:', finalHtml.html.length);

  const page2 = await browser.newPage();
  await page2.setContent(finalHtml.html, { waitUntil: 'load', timeout: 60000 });
  await page2.waitForTimeout(2000);
  await page2.pdf({
    path: path.resolve(__dirname, 'bundle-final.pdf'),
    preferCSSPageSize: true,
    printBackground: true,
  });
  await browser.close();
  console.log('pdf done');
})().catch((e) => { console.error(e); process.exit(1); });
