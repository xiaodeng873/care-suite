const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const { PDFParse } = require('pdf-parse');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 實驗用：可開關 named page
const scopeDoc = (page, scopeClass, useNamedPage) => {
  const { scopeCssText, scopeInlineScripts } = (() => {
    const b = esbuild.buildSync({
      entryPoints: [path.resolve('../apps/web/src/utils/cssScope.ts')],
      bundle: true, write: false, format: 'cjs',
    });
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', b.outputFiles[0].text)(mod, mod.exports, require);
    return mod.exports;
  })();
  const styleMatches = page.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  let hasBarePageRule = false;
  const scopedStyles = styleMatches.map((styleTag) => {
    let s = styleTag;
    if (useNamedPage) {
      s = s.replace(/@page\s*\{/g, () => { hasBarePageRule = true; return `@page ${scopeClass} {`; });
    }
    s = s.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/i, (_m, o, inner, c) => o + scopeCssText(inner, scopeClass) + c);
    return s;
  });
  if (hasBarePageRule) scopedStyles.push(`<style>.${scopeClass} { page: ${scopeClass}; }</style>`);
  const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1].trim() : page.trim();
  return {
    styles: scopedStyles.join('\n'),
    body: `<div class="${scopeClass}">${scopeInlineScripts(rawBody, scopeClass)}</div>`,
  };
};

const combine = (pages, useNamedPage) => {
  const parts = pages.map((p, i) => scopeDoc(p, `print-doc-${i}`, useNamedPage));
  return `<!DOCTYPE html><html lang="zh-HK"><head><meta charset="UTF-8">
<style>html, body { margin: 0; padding: 0; }
[class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }</style>
${parts.map((p) => p.styles).join('\n')}</head><body>
${parts.map((p) => p.body).join('\n')}</body></html>`;
};

(async () => {
  const tpl = (n) => fs.readFileSync(path.resolve('../doc_html', n + '.html'), 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  const run = async (label, names, useNamedPage, patch) => {
    const pages = names.map((n) => (patch ? patch(tpl(n)) : tpl(n)));
    const html = combine(pages, useNamedPage);
    const p = await ctx.newPage();
    await p.setContent(html);
    await p.waitForTimeout(400);
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    const parser = new PDFParse({ data: pdf });
    const res = await parser.getText();
    console.log(`${label}: ${res.pages.length} pages`);
    await parser.destroy();
    await p.close();
  };
  await run('A [候診,血糖] named   ', ['院友候診記錄表', '院友血糖記錄'], true);
  await run('B [候診,血糖] no-named', ['院友候診記錄表', '院友血糖記錄'], false);
  await run('C [候診-無固定高,血糖] named', ['院友候診記錄表', '院友血糖記錄'], true,
    (h) => h.replace('height: 194mm;', ''));
  await run('D [候診,血糖,體溫] no-named', ['院友候診記錄表', '院友血糖記錄', '院友體溫記錄'], false);
  await browser.close();
})();
