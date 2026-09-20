// 重現 bundle 列印路徑（printGroupedHtml 組裝 + padOddPageDocuments），
// 無頭 Chrome 出 PDF，解析內容流量度：每頁 logo 圖片座標 + 黑色筆劃（表格邊框）x 範圍
// 用法: node .print-diff/repro-nursing-bundle.mjs
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';
import { PDFDocument, PDFName, PDFRef, decodePDFRawStream } from 'pdf-lib';
import { inflateSync } from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// `?raw` import loader（doctor visit template 等 .html?raw）
const rawPlugin = {
  name: 'raw',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw' }, async (args) => {
      const fsMod = await import('fs');
      const text = fsMod.readFileSync(args.path, 'utf-8');
      return { contents: `export default ${JSON.stringify(text)};`, loader: 'js' };
    });
  },
};

const bundleNode = async (file) => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, file)],
    bundle: true, write: false, format: 'esm', platform: 'node', plugins: [stubPlugin, rawPlugin],
  });
  const url = 'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64');
  return await import(url);
};

// 瀏覽器端入口：expose padOddPageDocuments 到 window
const browserEntry = `
import * as printUtils from ${JSON.stringify(path.join(root, 'apps/web/src/utils/printUtils.ts').replace(/\\/g, '/'))};
window.__PU = printUtils;
`;
const entryFile = path.join(__dirname, '_repro-entry.ts');
const fs = await import('fs');
fs.writeFileSync(entryFile, browserEntry);
const browserBundle = await esbuild.build({
  entryPoints: [entryFile], bundle: true, write: false, format: 'iife', platform: 'browser', plugins: [stubPlugin],
});
const browserJs = browserOutput(browserBundle);

function browserOutput(result) {
  return result.outputFiles[0].text;
}

// ---- 模組 ----
const printUtils = await bundleNode('apps/web/src/utils/printUtils.ts');
const printPageLogo = await bundleNode('apps/web/src/utils/printPageLogo.ts');
const nursing = await bundleNode('apps/web/src/utils/patientLogNursingTreatmentGenerator.ts');
const cssScope = await bundleNode('apps/web/src/utils/cssScope.ts');
const { extractPageConfig, pageContentBoxMm, stripPageBlocks, unwrapPrintMedia, PX_PER_MM } = printUtils;
const { scopeCssText, scopeInlineScripts } = cssScope;

const scopeDocumentHtml = (page, scopeClass, wrapperStyle) => {
  const styleMatches = page.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const scopedStyles = styleMatches.map((styleTag) => {
    const openMatch = styleTag.match(/^<style([^>]*)>([\s\S]*?)<\/style>$/i);
    if (!openMatch) return styleTag;
    const [, attrs, innerCss] = openMatch;
    let scopedCss = scopeCssText(stripPageBlocks(innerCss), scopeClass);
    scopedCss = unwrapPrintMedia(scopedCss);
    return `<style${attrs}>${scopedCss}</style>`;
  });
  const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1].trim() : page.trim();
  const bodyContent = scopeInlineScripts(rawBody, scopeClass);
  return {
    styles: scopedStyles.join('\n'),
    body: `<div class="${scopeClass}"${wrapperStyle ? ` style="${wrapperStyle}"` : ''}>${bodyContent}</div>`,
  };
};

// ---- 生成傷口評估/衛生/約束 html ----
const wound = await bundleNode('apps/web/src/utils/woundAssessmentPrintGenerator.ts');
const hyg = await bundleNode('apps/web/src/utils/hygieneRecordPrintFormHtml.ts');
const rest = await bundleNode('apps/web/src/utils/restraintUsageRecordPrintGenerator.ts');
const redPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const dummyPatient = { 院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友', 床號: 'A103-2', 性別: '女', 出生日期: '1929-01-01', 身份證號碼: 'A123456(7)', 在住狀態: '在住' };
const blankWound = { id: 'blank', patient_id: 999, wound_code: '', wound_location: { x: 0, y: 0, side: 'front' }, status: 'active' };
const docs = [];
for (const [name, p] of [
  ['wound', await wound.generateWoundAssessmentHtml(blankWound, [], dummyPatient)],
]) {
  const pages = (p.match(/class="(container|page)"/g) || []).length;
  console.log(name, 'page divs:', pages, 'punch:', p.includes('punch-guide-fixed'));
  docs.push(printPageLogo.injectPageLogo(p, redPng));
}

// ---- 照 printGroupedHtml 組裝 ----
const pages = docs;
const config = extractPageConfig(docs[0]);
console.log('=== extractPageConfig ===', JSON.stringify(config));
const marginPageNames = new Map();
const pageRules = [];
const parts = pages.map((page, i) => {
  const pageConfig = extractPageConfig(page);
  const margin = pageConfig.margin;
  const pageKey = `${pageConfig.orientation}|${margin}`;
  let pageName = marginPageNames.get(pageKey);
  if (!pageName) {
    pageName = `pg-0-${marginPageNames.size}`;
    marginPageNames.set(pageKey, pageName);
    pageRules.push(`@page ${pageName} { size: ${config.size} ${pageConfig.orientation}; margin: ${margin}; }`);
  }
  const widthPx = pageContentBoxMm({ ...pageConfig, size: config.size }).w * PX_PER_MM;
  const wrapperStyle = `page: ${pageName};box-sizing:border-box;width:${widthPx.toFixed(1)}px;`;
  return { pageConfig, pageName, ...scopeDocumentHtml(page, `print-doc-0-${i}`, wrapperStyle) };
});
const baseCss = `
html, body { margin: 0; padding: 0; }
[class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
.no-print { display: none !important; }
@page { size: ${config.size}; margin: 0; }
${pageRules.join('\n')}`;
const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>${baseCss}</style>
${parts.map((p) => p.styles).join('\n')}
</head>
<body>
${parts.map((p) => p.body).join('\n')}
</body>
</html>`;

// ---- 無頭 Chrome ----
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setContent(combined, { waitUntil: 'load' });
await page.addScriptTag({ content: browserJs });

const domInfo = await page.evaluate(() => {
  const w = document.querySelector('[class*="print-doc-"]');
  const kids = Array.from(w.children).map((c) => `${c.tagName}.${typeof c.className === 'string' ? c.className : ''}`);
  const pages = Array.from(w.querySelectorAll(':scope > .page'));
  return {
    kidCount: kids.length,
    kids: kids.slice(0, 10),
    pageDivs: pages.length,
    pageBreaks: pages.map((p) => getComputedStyle(p).pageBreakAfter),
  };
});
console.log('=== DOM ===', JSON.stringify(domInfo));

// 喺瀏覽器內跑 padOddPageDocuments（duplex=true）
const padResult = await page.evaluate((args) => {
  const { selectors, css, duplex } = args;
  try {
    window.__PU.padOddPageDocuments(
      document,
      selectors.map((s, i) => ({ selector: s.selector, config: s.config, pageName: s.pageName })),
      css,
      duplex
    );
    const logos = Array.from(document.querySelectorAll('img.admission-page-logo')).map((l) => ({
      pos: l.style.position, top: l.style.top, left: l.style.left, w: l.style.width,
      parent: l.parentElement.className,
    }));
    return { ok: true, logos };
  } catch (e) {
    return { ok: false, error: e.message, stack: e.stack?.slice(0, 500) };
  }
}, {
  selectors: parts.map((p, i) => ({
    selector: `.print-doc-0-${i}`,
    config: { ...p.pageConfig, size: config.size },
    pageName: p.pageName,
  })),
  css: `${baseCss}\n${parts.map((p) => p.styles).join('\n')}`,
  duplex: process.env.DUPLEX !== "off",
});
console.log('=== padOddPageDocuments ===', JSON.stringify(padResult, null, 1));
const punchDump = await page.evaluate(() => {
  const PX = 96/25.4;
  const els = Array.from(document.querySelectorAll('.punch-guide-fixed'));
  const wrap = document.querySelector('[class*="print-doc-"]');
  const wr = wrap.getBoundingClientRect();
  return els.map(e => {
    const r = e.getBoundingClientRect();
    return { pos: getComputedStyle(e).position, left: e.style.left, top: e.style.top,
      absX: ((r.left - wr.left)/PX).toFixed(1), absY: ((r.top - wr.top)/PX).toFixed(1),
      parent: e.parentElement.className, display: getComputedStyle(e).display };
  });
});
console.log('=== punches ===', JSON.stringify(punchDump, null, 1));
const kidDump = await page.evaluate(() => {
  const PX = 96/25.4;
  const wrap = document.querySelector('[class*="print-doc-"]');
  return Array.from(wrap.children).map(c => ({ cls: c.className, offTopMm: (c.offsetTop/PX).toFixed(1), hMm: (c.getBoundingClientRect().height/PX).toFixed(1) }));
});
console.log('=== wrapper kids ===', JSON.stringify(kidDump, null, 1));

// ---- 出 PDF ----
const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
fs.writeFileSync(path.join(__dirname, 'repro-wound-debug.pdf'), pdfBuf);
await browser.close();

// ---- 解析 PDF 內容流 ----
const doc = await PDFDocument.load(pdfBuf);
const MM = 25.4 / 72;
const matMul = (m1, m2) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];
const xf = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

doc.getPages().forEach((p, pi) => {
  const { width, height } = p.getSize();
  const resolve = (o) => (o instanceof PDFRef ? doc.context.lookup(o) : o);
  let contents = p.node.get(PDFName.of('Contents'));
  contents = resolve(contents);
  const refs = contents && contents.constructor.name === 'PDFArray' ? contents.asArray() : [contents];
  let data = '';
  for (const r of refs) {
    const stream = resolve(r);
    if (!stream) continue;
    let bytes;
    try {
      bytes = inflateSync(stream.contents ?? stream.getContents());
    } catch {
      bytes = typeof stream.getContents === 'function' ? stream.getContents() : stream.contents;
    }
    if (!bytes) continue;
    data += Buffer.from(bytes).toString('latin1') + '\n';
  }
  if (!data.trim()) { console.log(`--- PDF page ${pi + 1}: no content stream ---`); return; }  const tokens = data.match(/\/[A-Za-z0-9_.+-]+|\[|\]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|[A-Za-z*]+|\S/g) || [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let pathPts = [];
  let strokeRgb = null;
  let fillRgb = null;
  let minX = Infinity, maxX = -Infinity, strokes = 0;
  let grayStrokes = 0, gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
  let minTopPt = Infinity, maxBottomPt = -Infinity;
  const images = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i++];
    // PDF 運算子係後置式：運算元喺運算子前面（t = tokens[i-1]）
    if (t === 'q') { stack.push(ctm); }
    else if (t === 'Q') { ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; }
    else if (t === 'cm') { const m6 = tokens.slice(i - 7, i - 1).map(Number); ctm = matMul(ctm, m6); }
    else if (t === 're') { const [x, y, w, h] = tokens.slice(i - 5, i - 1).map(Number); pathPts.push([x, y], [x + w, y + h]); }
    else if (t === 'm' || t === 'l') { const [x, y] = tokens.slice(i - 3, i - 1).map(Number); pathPts.push([x, y]); }
    else if (t === 'RG') { strokeRgb = tokens.slice(i - 4, i - 1).map(Number); }
    else if (t === 'rg') { fillRgb = tokens.slice(i - 4, i - 1).map(Number); }
    else if (t === 'S' || t === 's' || t === 'f' || t === 'f*' || t === 'F' || t === 'B' || t === 'B*' || t === 'b' || t === 'b*') {
      const rgb = t === 'S' || t === 's' ? strokeRgb : fillRgb;
      const isBlack = !rgb || rgb.every((v) => v < 0.5);
      const isGray = rgb && rgb.every((v) => v >= 0.4 && v <= 0.9); // 打孔圈 #999 虛線
      if (pathPts.length && (isBlack || isGray)) {
        if (isBlack) strokes++; else grayStrokes++;
        for (const [x, y] of pathPts) {
          const [tx, ty] = xf(ctm, x, y);
          if (isBlack) {
            minX = Math.min(minX, tx); maxX = Math.max(maxX, tx);
            minTopPt = Math.min(minTopPt, height - ty);
            maxBottomPt = Math.max(maxBottomPt, height - ty);
          } else {
            gMinX = Math.min(gMinX, tx); gMaxX = Math.max(gMaxX, tx);
            gMinY = Math.min(gMinY, height - ty); gMaxY = Math.max(gMaxY, height - ty);
          }
        }
      }
      pathPts = [];
    }
    else if (t === 'Do') {
      const name = tokens[i - 2]; // /Im0（喺 Do 前面）
      images.push({ name, at: xf(ctm, 0, 0), w: Math.hypot(ctm[0], ctm[1]), h: Math.hypot(ctm[2], ctm[3]) });
    }
    else if (t === 'W' || t === 'W*') { /* clipping */ }
    else if (t === 'n') { pathPts = []; }
  }
  const toMmX = (v) => +(v * MM).toFixed(2);
  const logoLines = images.map((im) => {
    const y = im.at[1] * MM;
    const topFromPaper = height * MM - y - im.h * MM;
    return `logo ${im.name}: left=${toMmX(im.at[0])}mm top(from paper top)=${topFromPaper.toFixed(2)}mm size=${(im.w * MM).toFixed(1)}x${(im.h * MM).toFixed(1)}mm`;
  });
  console.log(`--- PDF page ${pi + 1} (${(width * MM).toFixed(1)}x${(height * MM).toFixed(1)}mm) ---`);
  console.log(`  black strokes: ${strokes}, x range: ${strokes ? `${toMmX(minX)} ~ ${toMmX(maxX)}mm` : 'n/a'}, y(top-from-paper-top): ${strokes ? `${toMmX(minTopPt)} ~ ${toMmX(maxBottomPt)}mm` : 'n/a'}`);
  console.log(`  gray punches: ${grayStrokes}, x: ${grayStrokes ? `${toMmX(gMinX)} ~ ${toMmX(gMaxX)}mm` : 'n/a'}, y(top): ${grayStrokes ? `${toMmX(gMinY)} ~ ${toMmX(gMaxY)}mm` : 'n/a'}`);
  logoLines.forEach((l) => console.log(' ', l));
});
console.log('done');
