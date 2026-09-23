// repro-restraint-bundle：重現「約束物品頁列印」vs「綜合列印」兩條路徑嘅 HTML 差異
// 用法：node .print-diff/repro-restraint-bundle.js
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');

const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    build.onResolve({ filter: /facilitySettings/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
  },
};

async function bundle(entry) {
  const r = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true, write: false, format: 'cjs', platform: 'node',
    plugins: [stubPlugin],
    loader: { '.html': 'text' },
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result_text(r))(mod, mod.exports, require);
  return mod.exports;
}
function result_text(r) { return r.outputFiles[0].text; }

(async () => {
  const gen = await bundle('apps/web/src/utils/restraintConsentPrintGenerator.ts');
  const printUtils = await bundle('apps/web/src/utils/printUtils.ts');

  const patient = { 中文姓氏: '李', 中文名字: '玉嬋', 中文姓名: '李玉嬋', 性別: '女', 出生日期: '1932-05-01', 身份證號碼: 'B727108(0)' };
  const assessment = {}; // 空白

  const standaloneHtml = gen.generateRestraintConsentPrintHtml(assessment, patient, '善頤(福群)護老院');
  fs.writeFileSync(path.join(__dirname, 'restraint-standalone.html'), standaloneHtml);

  // 模擬綜合列印 printGroupedHtml 對單份文件嘅處理（strip + scope + 具名 @page）
  const config = printUtils.extractPageConfig(standaloneHtml);
  console.log('extractPageConfig:', JSON.stringify(config));

  // scopeDocumentHtml 係 internal，用 bundle 後嘅 printCombinedHtml 唔直接暴露……
  // 改為直接喺瀏覽器載入兩個版本對比：standalone vs 模擬合併
  // 呢度簡單重建 printGroupedHtml 嘅單頁輸出
  const scopeClass = 'print-doc-0-0';
  const pageName = 'pg-0-0';
  // 用 printUtils 內部邏輯需要 scopeDocumentHtml——冇 export，自己照做：
  // strip @page + scope CSS + unwrap @media print
  const styleMatches = standaloneHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const bodyMatch = standaloneHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  // 借用 cssScope 模組
  const cssScope = await bundle('apps/web/src/utils/cssScope.ts');
  const scopedStyles = styleMatches.map((styleTag) => {
    const openMatch = styleTag.match(/^<style([^>]*)>([\s\S]*?)<\/style>$/i);
    const [, attrs, innerCss] = openMatch;
    let css = printUtils.stripPageBlocks(innerCss);
    css = cssScope.scopeCssText(css, scopeClass);
    css = printUtils.unwrapPrintMedia(css);
    return `<style${attrs}>${css}</style>`;
  }).join('\n');

  const PX_PER_MM = 96 / 25.4;
  const widthMm = 210 - 12 - 12; // A4 - margin 0 12mm 10mm 12mm
  const widthPx = widthMm * PX_PER_MM;
  const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>
html, body { margin: 0; padding: 0; }
.no-print { display: none !important; }
@page { size: A4; margin: 0; }
@page ${pageName} { size: A4 portrait; margin: 0 12mm 10mm 12mm; }
</style>
${scopedStyles}
</head>
<body>
<div class="${scopeClass}" style="page: ${pageName};box-sizing:border-box;width:${widthPx.toFixed(1)}px;">
${cssScope.scopeInlineScripts(bodyMatch ? bodyMatch[1] : '', scopeClass)}
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(__dirname, 'restraint-bundle-sim.html'), combined);
  console.log('written: restraint-standalone.html / restraint-bundle-sim.html');
})();
