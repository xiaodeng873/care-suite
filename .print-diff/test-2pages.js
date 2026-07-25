const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const { PDFParse } = require('pdf-parse');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 簡化版 scope：只按 orientation 分兩個 named page，不保留各文件獨特 margin
const scope2 = (page, i) => {
  const isLand = /size:\s*A4\s+landscape/i.test(page);
  const pageName = isLand ? 'print-landscape' : 'print-portrait';
  const styleMatches = page.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const scopedStyles = styleMatches.map((styleTag) => {
    let s = styleTag.replace(/@page\s*\{/gi, `@page ${pageName} {`);
    s = s.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/i, (_m, o, inner, c) => {
      // 加容器前綴
      const scoped = inner.replace(/(^|[}>,\n\r]\s*)body(?=[\s,{:.#\[])/gm, `$1.print-doc-${i}`);
      return o + scoped + c;
    });
    return s;
  });
  scopedStyles.push(`<style>.print-doc-${i} { page: ${pageName}; }</style>`);
  const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1].trim() : page.trim();
  return { styles: scopedStyles.join('\n'), body: `<div class="print-doc-${i}">${bodyContent}</div>` };
};

const combine2 = (pages) => {
  const parts = pages.map((p, i) => scope2(p, i));
  return `<!DOCTYPE html><html lang="zh-HK"><head><meta charset="UTF-8">
<style>html,body{margin:0;padding:0}</style>
${parts.map((p) => p.styles).join('\n')}</head><body>
${parts.map((p) => p.body).join('\n')}</body></html>`;
};

(async () => {
  const names = JSON.parse(fs.readFileSync('cases-list.json', 'utf8'));
  const tpl = (n) => fs.readFileSync(path.resolve('../doc_html', n + '.html'), 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  const html = combine2(names.map(tpl));
  fs.writeFileSync('shots/_all_2page.html', html);
  const p = await ctx.newPage();
  await p.setContent(html);
  await p.waitForTimeout(600);
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  const parser = new PDFParse({ data: pdf });
  const res = await parser.getText();
  console.log('2-page groups: ' + res.pages.length + ' pages');
  await parser.destroy();
  await p.close();
  await browser.close();
})();
