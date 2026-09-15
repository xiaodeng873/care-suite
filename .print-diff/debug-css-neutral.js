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

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/patientLogNursingTreatmentGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const dummyPatient = { 院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友', 床號: 'A101-1', 性別: '女', 出生日期: '1929-01-01', 在住狀態: '在住' };
  const logs = [];
  for (let i = 0; i < 34; i++) logs.push({ id: `L${i}`, patient_id: 999, log_date: `2025-07-${String((i % 28) + 1).padStart(2, '0')}`, log_type: '其他', content: `測試護理內容 ${i}`, recorder: '測試員' });
  const docHtml = await mod.exports.generatePatientLogNursingTreatmentHtml(logs, [dummyPatient], logs.map(l => l.id));
  const stylesRaw = (docHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).map(t => t.replace(/^<style[^>]*>|<\/style>$/gi, '')).join('\n').replace(/@page[^{]*\{[^}]*\}/g, '');
  const body = docHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].trim();

  const variants = {
    '原樣': stylesRaw,
    '去overflow:hidden': stylesRaw.replace('overflow: hidden;', ''),
    '去margin-top:auto': stylesRaw.replace('margin-top: auto;', ''),
    'min-height改height': stylesRaw.replace('min-height: ${PAGE_CONTENT_HEIGHT_MM}mm;', '').replace('min-height: 287mm;', 'height: 287mm;'),
    '去flex': stylesRaw.replace('display: flex;\n      flex-direction: column;', '').replace(/\.page \{\n      min-height: 287mm;\n      box-sizing: border-box;\n      display: flex;\n      flex-direction: column;/, '.page {\n      min-height: 287mm;\n      box-sizing: border-box;'),
    'page-content去flex-grow': stylesRaw.replace('flex-grow: 1;', ''),
  };

  const browser = await chromium.launch({ executablePath: CHROME });
  for (const [name, st] of Object.entries(variants)) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;}@page{size:A4 portrait;margin:0;}</style><style>${st}</style></head><body><div class="print-doc-0-0" style="padding: 5mm 6.35mm; box-sizing: border-box;">${body}</div></body></html>`;
    const p = await (await browser.newContext()).newPage();
    await p.setContent(html, { waitUntil: 'load' });
    const pdfBuf = await p.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log(name, 'pdfPages=', pdfDoc.getPageCount());
    await p.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
