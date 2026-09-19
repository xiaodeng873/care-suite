// 重現 printCombinedHtml（scope 模式）路徑：日誌頁直印按鈕行呢條路
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';
import { PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import { inflateSync } from 'zlib';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');

const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
  },
};
const bundleNode = async (file) => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, file)],
    bundle: true, write: false, format: 'esm', platform: 'node', plugins: [stubPlugin],
  });
  return await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
};

const browserEntry = `
import * as printUtils from ${JSON.stringify(path.join(root, 'apps/web/src/utils/printUtils.ts').replace(/\\/g, '/'))};
window.__PU = printUtils;
`;
const entryFile = path.join(__dirname, '_repro-entry2.ts');
fs.writeFileSync(entryFile, browserEntry);
const browserBundle = await esbuild.build({
  entryPoints: [entryFile], bundle: true, write: false, format: 'iife', platform: 'browser', plugins: [stubPlugin],
});
const browserJs = browserBundle.outputFiles[0].text;

const printUtils = await bundleNode('apps/web/src/utils/printUtils.ts');
const nursing = await bundleNode('apps/web/src/utils/patientLogNursingTreatmentGenerator.ts');
const cssScope = await bundleNode('apps/web/src/utils/cssScope.ts');
const { extractPageConfig, pageContentBoxMm, unwrapPrintMedia, PX_PER_MM } = printUtils;
const { scopeCssText, scopeInlineScripts } = cssScope;

// printCombinedHtml 嘅 scope 組裝（忠實複刻）
const scopeDocumentHtmlScope = (page, scopeClass, wrapperStyle) => {
  const styleMatches = page.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  let hasBarePageRule = false;
  const scopedStyles = styleMatches.map((styleTag) => {
    const openMatch = styleTag.match(/^<style([^>]*)>([\s\S]*?)<\/style>$/i);
    if (!openMatch) return styleTag;
    const [, attrs, innerCss] = openMatch;
    let scopedCss = scopeCssText(innerCss, scopeClass);
    scopedCss = unwrapPrintMedia(scopedCss);
    scopedCss = scopedCss.replace(/@page\s*\{/g, () => {
      hasBarePageRule = true;
      return `@page ${scopeClass} {`;
    });
    return `<style${attrs}>${scopedCss}</style>`;
  });
  if (hasBarePageRule) {
    scopedStyles.push(`<style>.${scopeClass} { page: ${scopeClass}; }</style>`);
  }
  const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1].trim() : page.trim();
  const bodyContent = scopeInlineScripts(rawBody, scopeClass);
  return {
    styles: scopedStyles.join('\n'),
    body: `<div class="${scopeClass}"${wrapperStyle ? ` style="${wrapperStyle}"` : ''}>${bodyContent}</div>`,
  };
};

const dummyPatient = {
  院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友',
  床號: 'A103-2', 性別: '女', 出生日期: '1929-01-01', 在住狀態: '在住',
};
const blankLog = { id: 'blank', patient_id: 999, log_date: '', log_type: '其他', content: '', recorder: '' };
const nursingHtml = await nursing.generatePatientLogNursingTreatmentHtml([blankLog], [dummyPatient], ['blank']);

// 直印路徑冇 injectPageLogo？—— 有：PatientLogs 直印？查：printPatientLogNursingTreatment 直接 printCombinedHtml([html])，冇 logo 注入！
// 但用戶截圖有 logo → 用戶行 bundle。不過直印路徑都測埋（無 logo 版）+ 有 logo 版兩個。
const redPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const printPageLogo = await bundleNode('apps/web/src/utils/printPageLogo.ts');
const withLogo = printPageLogo.injectPageLogo(nursingHtml, redPng);

for (const [label, html] of [['直印(無logo)', nursingHtml], ['直印(有logo)', withLogo]]) {
  const config = extractPageConfig(html);
  const widthPx = pageContentBoxMm(config).w * PX_PER_MM;
  const part = scopeDocumentHtmlScope(html, 'print-doc-0', `box-sizing:border-box;width:${widthPx.toFixed(1)}px;`);
  const baseCss = `
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  .no-print { display: none !important; }`;
  const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>${baseCss}</style>
${part.styles}
</head>
<body>
${part.body}
</body>
</html>`;

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(combined, { waitUntil: 'load' });
  await page.addScriptTag({ content: browserJs });
  const pad = await page.evaluate((args) => {
    try {
      window.__PU.padOddPageDocuments(document, args.selectors, args.css, true);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }, { selectors: [{ selector: '.print-doc-0', config }], css: `${baseCss}\n${part.styles}` });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const doc = await PDFDocument.load(pdfBuf);
  const MM = 25.4 / 72;
  console.log(`=== ${label}：${doc.getPageCount()} 頁（pad: ${JSON.stringify(pad)}）===`);
  doc.getPages().forEach((p, pi) => {
    const { width, height } = p.getSize();
    let contents = p.node.get(PDFName.of('Contents'));
    const resolve = (o) => (o instanceof PDFRef ? doc.context.lookup(o) : o);
    contents = resolve(contents);
    const refs = contents && contents.constructor.name === 'PDFArray' ? contents.asArray() : [contents];
    let data = '';
    for (const r of refs) {
      const stream = resolve(r);
      if (!stream) continue;
      let bytes;
      try { bytes = inflateSync(stream.contents ?? stream.getContents()); }
      catch { bytes = typeof stream.getContents === 'function' ? stream.getContents() : stream.contents; }
      if (!bytes) continue;
      data += Buffer.from(bytes).toString('latin1') + '\n';
    }
    const tokens = data.match(/\/[A-Za-z0-9_.+-]+|\[|\]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|[A-Za-z*]+|\S/g) || [];
    const matMul = (m1, m2) => [
      m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ];
    const xf = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    let pathPts = [];
    let strokeRgb = null, fillRgb = null;
    let minX = Infinity, maxX = -Infinity, strokes = 0, minTopPt = Infinity;
    const images = [];
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i++];
      if (t === 'q') stack.push(ctm);
      else if (t === 'Q') ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (t === 'cm') { const m6 = tokens.slice(i - 7, i - 1).map(Number); ctm = matMul(ctm, m6); }
      else if (t === 're') { const [x, y, w, h] = tokens.slice(i - 5, i - 1).map(Number); pathPts.push([x, y], [x + w, y + h]); }
      else if (t === 'm' || t === 'l') { const [x, y] = tokens.slice(i - 3, i - 1).map(Number); pathPts.push([x, y]); }
      else if (t === 'RG') strokeRgb = tokens.slice(i - 4, i - 1).map(Number);
      else if (t === 'rg') fillRgb = tokens.slice(i - 4, i - 1).map(Number);
      else if (['S', 's', 'f', 'f*', 'F', 'B', 'B*', 'b', 'b*'].includes(t)) {
        const rgb = t === 'S' || t === 's' ? strokeRgb : fillRgb;
        if (pathPts.length && (!rgb || rgb.every((v) => v < 0.5))) {
          strokes++;
          for (const [x, y] of pathPts) {
            const [tx, ty] = xf(ctm, x, y);
            minX = Math.min(minX, tx); maxX = Math.max(maxX, tx);
            minTopPt = Math.min(minTopPt, height - ty);
          }
        }
        pathPts = [];
      }
      else if (t === 'Do') images.push({ name: tokens[i - 2], at: xf(ctm, 0, 0), w: Math.hypot(ctm[0], ctm[1]), h: Math.hypot(ctm[2], ctm[3]) });
      else if (t === 'n') pathPts = [];
    }
    const toMm = (v) => +(v * MM).toFixed(2);
    const logos = images.map((im) => `logo@(${toMm(im.at[0])}, ${(height * MM - im.at[1] * MM - im.h * MM).toFixed(2)})`).join(' ');
    console.log(`  page ${pi + 1}: strokes=${strokes} x=${strokes ? `${toMm(minX)}~${toMm(maxX)}` : '-'} topY=${strokes ? toMm(minTopPt) : '-'}mm ${logos}`);
  });
}
console.log('done');
