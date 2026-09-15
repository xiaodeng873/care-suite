// e2e：雙面列印補頁 —— 用真實 padOddPageDocuments（esbuild bundle printUtils）
// 三份真實文件合併，補頁後每份文件必須由單數頁（紙嘅正面）開始
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
  },
};

(async () => {
  const load = async (entry) => {
    const result = await esbuild.build({
      entryPoints: [path.join(root, entry)],
      bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
    });
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
    return { text: result.outputFiles[0].text, exports: mod.exports };
  };
  const { scopeCssText, scopeInlineScripts } = (await load('apps/web/src/utils/cssScope.ts')).exports;
  const PU = (await load('apps/web/src/utils/printUtils.ts')).exports;
  const { injectPageLogo } = (await load('apps/web/src/utils/printPageLogo.ts')).exports;
  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const logoSrc = `data:image/png;base64,${pngB64}`;

  const scopeDocumentHtml = (page, scopeClass, wrapperStyle) => {
    const styleMatches = page.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const scopedStyles = styleMatches.map((styleTag) => {
      const openMatch = styleTag.match(/^<style([^>]*)>([\s\S]*?)<\/style>$/i);
      if (!openMatch) return styleTag;
      const [, attrs, innerCss] = openMatch;
      return `<style${attrs}>${PU.unwrapPrintMedia(scopeCssText(PU.stripPageBlocks(innerCss), scopeClass))}</style>`;
    });
    const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const rawBody = bodyMatch ? bodyMatch[1].trim() : page.trim();
    return {
      styles: scopedStyles.join('\n'),
      body: `<div class="${scopeClass}"${wrapperStyle ? ` style="${wrapperStyle}"` : ''}>${scopeInlineScripts(rawBody, scopeClass)}</div>`,
    };
  };

  const files = ['院友護理評估記錄.html', '院友體溫記錄.html', '院友外出同意書.html'];
  const docs = files.map((f) => injectPageLogo(fs.readFileSync(path.join(root, 'upload/doc_html', f), 'utf8'), logoSrc));
  const configs = docs.map((d) => PU.extractPageConfig(d));

  // 完全複製 printGroupedHtml：按（已 normalize）margin 分具名 @page，wrapper border-box
  const marginPageNames = new Map();
  const pageRules = [];
  const parts = docs.map((d, i) => {
    const margin = configs[i].margin;
    let pageName = marginPageNames.get(margin);
    if (!pageName) {
      pageName = `pg-0-${marginPageNames.size}`;
      marginPageNames.set(margin, pageName);
      pageRules.push(`@page ${pageName} { size: A4; margin: ${margin}; }`);
    }
    const widthPx = PU.pageContentBoxMm(configs[i]).w * (96 / 25.4);
    return scopeDocumentHtml(d, `print-doc-0-${i}`, `page: ${pageName};box-sizing:border-box;width:${widthPx.toFixed(1)}px;`);
  });
  const baseCss = `
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 0; }
  ${pageRules.join('\n  ')}`;
  const allCss = `${baseCss}\n${parts.map((p) => p.styles).join('\n')}`;
  const combined = `<!DOCTYPE html>
<html lang="zh-HK"><head><meta charset="UTF-8"><style>${baseCss}</style>
${parts.map((p) => p.styles).join('\n')}</head>
<body>${parts.map((p) => p.body).join('\n')}</body></html>`;

  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });

  // 注入真實 printUtils bundle
  const puBundle = (await load('apps/web/src/utils/printUtils.ts')).text;

  const buildPdf = async (withPad) => {
    const page = await ctx.newPage();
    await page.setContent(combined, { waitUntil: 'load' });
    await page.addScriptTag({ content: `window.PU = (function(){const m={exports:{}};new Function('module','exports','require',${JSON.stringify(puBundle)})(m,m.exports,function(){return {};});return m.exports;})();` });
    const info = await page.evaluate(async (pad) => {
      await document.fonts.ready;
      const wrappers = [0, 1, 2].map((i) => ({
        selector: `.print-doc-0-${i}`,
        config: window.__CONFIGS__[i],
      }));
      const heights = wrappers.map((w) => {
        const el = document.querySelector(w.selector);
        return el ? Math.round(el.getBoundingClientRect().height) : -1;
      });
      if (pad) {
        window.PU.padOddPageDocuments(document, wrappers, window.__ALL_CSS__);
      }
      return { heights, spacers: document.querySelectorAll('[class*="print-doc-blank-"]').length };
    }, withPad);
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.close();
    return { pdfBuf, info };
  };

  // allCss 同 configs 傳入 page context
  await ctx.addInitScript((data) => { window.__ALL_CSS__ = data.css; window.__CONFIGS__ = data.cfgs; }, { css: allCss, cfgs: configs });

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const pt2mm = (pt) => (pt * 25.4) / 72;
  const matMul = (m, n) => {
    const [a1, b1, c1, d1, e1, f1] = m; const [a2, b2, c2, d2, e2, f2] = n;
    return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
  };
  const applyM = (m, x, y) => { const [a, b, c, d, e, f] = m; return [a * x + c * y + e, b * x + d * y + f]; };
  const pageInfo = async (buf) => {
    const d = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const out = [];
    for (let p = 1; p <= d.numPages; p++) {
      const pg = await d.getPage(p);
      const vp = pg.getViewport({ scale: 1 });
      const tc = await pg.getTextContent();
      const ops = await pg.getOperatorList();
      const stack = []; let ctm = [1, 0, 0, 1, 0, 0]; const logos = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() || ctm;
        else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
        else if (fn === OPS.paintImageXObject) {
          const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
          const w = pt2mm(Math.abs(pts[1][0] - pts[0][0]));
          if (w > 25 && w < 40) logos.push({ top: pt2mm(vp.height - Math.max(...pts.map((q) => q[1]))), left: pt2mm(Math.min(...pts.map((q) => q[0]))) });
        }
      }
      out.push({ text: tc.items.map((it) => it.str).join(''), logos });
    }
    return out;
  };

  const before = await buildPdf(false);
  const after = await buildPdf(true);
  await browser.close();
  console.log('heights(px) =', JSON.stringify(after.info.heights));

  const beforePages = await pageInfo(before.pdfBuf);
  const afterPages = await pageInfo(after.pdfBuf);
  console.log('補頁前頁數 =', beforePages.length, ' 補頁後頁數 =', afterPages.length, ' spacer =', after.info.spacers);
  afterPages.forEach((pg, i) =>
    console.log(`  page ${i + 1}: ${pg.text.length} chars, logos=${pg.logos.length} @${pg.logos.map((l) => `${l.top.toFixed(1)},${l.left.toFixed(1)}`).join(' ')} | ${pg.text.slice(0, 24).replace(/\s+/g, ' ')}`));

  // 斷言一：每份文件嘅識別字串出現喺單數頁
  const markers = ['護理評估', '體溫', '外出'];
  let pass = afterPages.length === beforePages.length + after.info.spacers;
  markers.forEach((mk) => {
    const p = afterPages.findIndex((pg) => pg.text.includes(mk)) + 1;
    const ok = p >= 1 && p % 2 === 1;
    if (!ok) pass = false;
    console.log(`  「${mk}」起始頁 = ${p}${ok ? '' : ' ← FAIL（唔係單數頁）'}`);
  });
  // 斷言二：空白補頁（0 chars）必須冇 logo；有內容嘅頁必須啱啱一個 logo
  afterPages.forEach((pg, i) => {
    const isBlank = pg.text.length === 0;
    const ok = isBlank ? pg.logos.length === 0 : pg.logos.length === 1;
    if (!ok) pass = false;
    console.log(`  page ${i + 1}: ${isBlank ? '空白頁' : '內容頁'} logos=${pg.logos.length}${ok ? '' : ' ← FAIL'}`);
  });
  console.log(pass ? 'PASS：雙面每份文件佔自己嘅紙，空白頁冇 logo，內容頁一個 logo' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
