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
  const browser = await chromium.launch({ executablePath: CHROME });

  for (const n of [34, 35, 68, 69]) {
    const logs = [];
    for (let i = 0; i < n; i++) logs.push({ id: `L${i}`, patient_id: 999, log_date: `2025-07-${String((i % 28) + 1).padStart(2, '0')}`, log_type: '其他', content: `測試護理內容 ${i}`, recorder: '測試員' });
    const docHtml = await mod.exports.generatePatientLogNursingTreatmentHtml(logs, [dummyPatient], logs.map(l => l.id));
    const styles = (docHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).map(t => t.replace(/^<style[^>]*>|<\/style>$/gi, '')).join('\n').replace(/@page[^{]*\{[^}]*\}/g, '');
    const body = docHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].trim();

    // named page 方案：margin 透過具名 @page 套用，無 padding wrapper
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;}[class*="print-doc-"]+[class*="print-doc-"]{page-break-before:always;}@page{size:A4 portrait;margin:0;}@page pg0{size:A4 portrait;margin:5mm 0.25in;}</style><style>${styles}</style></head><body><div class="print-doc-0-0" style="page: pg0;">${body}</div></body></html>`;
    const page = await (await browser.newContext()).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log(`rows=${n} named-page pdfPages=`, pdfDoc.getPageCount());
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
