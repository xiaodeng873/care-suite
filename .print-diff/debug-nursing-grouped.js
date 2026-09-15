// 模擬 printGroupedHtml 的 strip+padding 包裝，測試護理及治療記錄會否超頁
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const { PDFDocument } = require('pdf-lib');

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

const bundle = async (file) => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, file)],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
};

(async () => {
  const printUtils = await bundle('apps/web/src/utils/printUtils.ts');
  const nursing = await bundle('apps/web/src/utils/patientLogNursingTreatmentGenerator.ts');

  const dummyPatient = {
    院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友',
    床號: 'A101-1', 性別: '女', 出生日期: '1929-01-01', 在住狀態: '在住',
  };

  // 模擬 scopeDocumentHtml(page, 'print-doc-0-0', 'strip', 'padding: 5mm 6.35mm; box-sizing: border-box;')
  const scopeDoc = (page, scopeClass, wrapperStyle) => {
    const styleMatches = page.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const scopedStyles = styleMatches.map((styleTag) => {
      const innerCss = styleTag.replace(/^<style[^>]*>|<\/style>$/gi, '');
      return `<style>${printUtils.stripPageBlocks(innerCss)}</style>`;
    });
    const bodyContent = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? page.trim();
    return {
      styles: scopedStyles.join('\n'),
      body: `<div class="${scopeClass}" style="${wrapperStyle}">${bodyContent}</div>`,
    };
  };

  const logs = [];
  for (let i = 0; i < 35; i++) {
    logs.push({
      id: `L${i}`, patient_id: 999,
      log_date: `2025-07-${String((i % 28) + 1).padStart(2, '0')}`,
      log_type: '其他', content: `測試護理內容 ${i}`, recorder: '測試員',
    });
  }
  const docHtml = await nursing.generatePatientLogNursingTreatmentHtml(logs, [dummyPatient], logs.map(l => l.id));
  const margin = printUtils.extractPageConfig(docHtml).margin;
  console.log('extracted margin:', margin);
  const part = scopeDoc(docHtml, 'print-doc-0-0', `padding: ${margin}; box-sizing: border-box;`);
  const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 0; }
</style>
${part.styles}
</head>
<body>
${part.body}
</body>
</html>`;

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(combined, { waitUntil: 'load' });
  const measure = await page.evaluate(() => {
    const pxToMm = (px) => (px * 25.4) / 96;
    const wrapper = document.querySelector('.print-doc-0-0');
    const pages = Array.from(document.querySelectorAll('.page'));
    return {
      wrapperTopMm: Math.round(pxToMm(wrapper.getBoundingClientRect().top + window.scrollY) * 100) / 100,
      wrapperHeightMm: Math.round(pxToMm(wrapper.getBoundingClientRect().height) * 100) / 100,
      pageTopsMm: pages.map(p => Math.round(pxToMm(p.getBoundingClientRect().top + window.scrollY) * 100) / 100),
      pageHeightsMm: pages.map(p => Math.round(pxToMm(p.getBoundingClientRect().height) * 100) / 100),
    };
  });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  const pdfDoc = await PDFDocument.load(pdfBuf);
  console.log(JSON.stringify(measure), 'pdfPages=', pdfDoc.getPageCount());
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
