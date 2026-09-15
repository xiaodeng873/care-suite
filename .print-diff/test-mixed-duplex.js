// e2e：混合方向同一 iframe —— 直向文件 + 橫向急症室記錄 + 直向文件
// 驗證：頁面尺寸啱、雙面補頁後每份文件由單數頁開始、logo 統一 @2mm、空白頁冇 logo
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
const pt2mm = (pt) => (pt * 25.4) / 72;
function matMul(m, n) {
  const [a1, b1, c1, d1, e1, f1] = m; const [a2, b2, c2, d2, e2, f2] = n;
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}
const applyM = (m, x, y) => { const [a, b, c, d, e, f] = m; return [a * x + c * y + e, b * x + d * y + f]; };

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

  // 直向 → 橫向（急症室）→ 直向
  const files = ['院友護理評估記錄.html', '使用急症室留院記錄.html', '院友外出同意書.html'];
  const docs = files.map((f) => injectPageLogo(fs.readFileSync(path.join(root, 'upload/doc_html', f), 'utf8'), logoSrc));
  const configs = docs.map((d) => PU.extractPageConfig(d));
  console.log('configs =', configs.map((c) => `${c.orientation} ${c.margin}`));

  // 完全複製新 printGroupedHtml：按 size 一組，orientation+margin 具名 @page
  const marginPageNames = new Map();
  const pageRules = [];
  const parts = docs.map((d, i) => {
    const key = `${configs[i].orientation}|${configs[i].margin}`;
    let pageName = marginPageNames.get(key);
    if (!pageName) {
      pageName = `pg-0-${marginPageNames.size}`;
      marginPageNames.set(key, pageName);
      pageRules.push(`@page ${pageName} { size: A4 ${configs[i].orientation}; margin: ${configs[i].margin}; }`);
    }
    const widthPx = PU.pageContentBoxMm(configs[i]).w * (96 / 25.4);
    return { pageName, ...scopeDocumentHtml(d, `print-doc-0-${i}`, `page: ${pageName};box-sizing:border-box;width:${widthPx.toFixed(1)}px;`) };
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
  const puBundle = (await load('apps/web/src/utils/printUtils.ts')).text;
  await ctx.addInitScript((data) => { window.__ALL_CSS__ = data.css; window.__CONFIGS__ = data.cfgs; window.__PAGENAMES__ = data.names; },
    { css: allCss, cfgs: configs, names: parts.map((p) => p.pageName) });

  const page = await ctx.newPage();
  await page.setContent(combined, { waitUntil: 'load' });
  await page.addScriptTag({ content: `window.PU = (function(){const m={exports:{}};new Function('module','exports','require',${JSON.stringify(puBundle)})(m,m.exports,function(){return {};});return m.exports;})();` });
  const info = await page.evaluate(async () => {
    await document.fonts.ready;
    const wrappers = [0, 1, 2].map((i) => ({
      selector: `.print-doc-0-${i}`,
      config: window.__CONFIGS__[i],
      pageName: window.__PAGENAMES__[i],
    }));
    const heights = wrappers.map((w) => {
      const el = document.querySelector(w.selector);
      return el ? Math.round(el.getBoundingClientRect().height) : -1;
    });
    window.PU.padOddPageDocuments(document, wrappers, window.__ALL_CSS__);
    return { heights, spacers: document.querySelectorAll('[class*="print-doc-blank-"]').length };
  });
  const pdfBuf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  await browser.close();

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const d = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  console.log('heights(px) =', JSON.stringify(info.heights), ' spacers =', info.spacers, ' pages =', d.numPages);
  const pages = [];
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
        if (w > 25 && w < 40) logos.push({ top: +pt2mm(vp.height - Math.max(...pts.map((q) => q[1]))).toFixed(1), left: +pt2mm(Math.min(...pts.map((q) => q[0]))).toFixed(1) });
      }
    }
    const size = `${(vp.width * 25.4 / 72).toFixed(0)}x${(vp.height * 25.4 / 72).toFixed(0)}`;
    pages.push({ size, text: tc.items.map((it) => it.str).join(''), logos });
    console.log(`  page ${p}: ${size}mm ${pages[p - 1].text.length}chars logos=${logos.length} @${logos.map((l) => `${l.top},${l.left}`).join(' ')} | ${pages[p - 1].text.slice(0, 20).replace(/\s+/g, ' ')}`);
  }

  let pass = true;
  // 每份文件由單數頁開始
  const markers = [{ m: '護理評估', o: 'portrait' }, { m: '急症室', o: 'landscape' }, { m: '外出', o: 'portrait' }];
  markers.forEach(({ m, o }) => {
    const idx = pages.findIndex((pg) => pg.text.includes(m));
    const sizeOk = o === 'landscape' ? pages[idx]?.size.startsWith('297x210') : pages[idx]?.size.startsWith('210x297');
    const ok = idx >= 0 && (idx + 1) % 2 === 1 && sizeOk;
    if (!ok) pass = false;
    console.log(`  「${m}」起始頁 = ${idx + 1} (${pages[idx]?.size})${ok ? '' : ' ← FAIL'}`);
  });
  // 空白頁冇 logo、內容頁一個 logo 且喺該方向嘅右上 2mm
  pages.forEach((pg, i) => {
    const isBlank = pg.text.length === 0;
    const paperW = pg.size.startsWith('297x210') ? 297 : 210;
    const logoOk = pg.logos.length === 1 && Math.abs(pg.logos[0].top - 2) < 0.8 && Math.abs(pg.logos[0].left - (paperW - 2 - 32)) < 1.2;
    const ok = isBlank ? pg.logos.length === 0 : logoOk;
    if (!ok) pass = false;
    console.log(`  page ${i + 1}: ${isBlank ? '空白頁' : '內容頁'} logos=${pg.logos.length}${ok ? '' : ' ← FAIL'}`);
  });
  console.log(pass ? 'PASS：橫向急症室同直向文件同一 iframe，雙面唔混紙，logo 統一 @2mm' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
