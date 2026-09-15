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
  const styles = (docHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).map(t => t.replace(/^<style[^>]*>|<\/style>$/gi, '')).join('\n').replace(/@page[^{]*\{[^}]*\}/g, '');
  const body = docHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].trim();
  const headerFull = body.match(/<div class="page-header">[\s\S]*?<\/table>\s*<\/div>/)[0];
  const footerFull = body.match(/<div class="footer">[\s\S]*?<\/div>\s*<\/div>$/)[0].replace(/<\/div>$/, '');
  const plainTable = `<table class="main-table"><colgroup><col class="col-date"><col class="col-content"><col class="col-sign"></colgroup><thead><tr><th>日期/更期</th><th>護理/治療</th><th>簽名</th></tr></thead><tbody>${Array(34).fill('<tr class="data-row"><td class="center-input"></td><td class="content-cell"><div class="content-wrap"><span></span></div></td><td class="center-input"></td></tr>').join('')}</tbody></table>`;
  const realTable = body.match(/<table class="main-table">[\s\S]*?<\/table>/)[0];

  const page = (h, c, f) => `<div class="page">${h}<div class="page-content">${c}</div>${f}</div>`;
  const variants = {
    '真header+空table34行+真footer': page(headerFull, plainTable, footerFull),
    '真header+真table+真footer(重組)': page(headerFull, realTable, footerFull),
    '空header+真table+真footer': page('<div class="page-header"></div>', realTable, footerFull),
    '真header+真table+空footer': page(headerFull, realTable, '<div class="footer"></div>'),
  };

  const browser = await chromium.launch({ executablePath: CHROME });
  for (const [name, b] of Object.entries(variants)) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;}@page{size:A4 portrait;margin:0;}</style><style>${styles}</style></head><body><div class="print-doc-0-0" style="padding: 5mm 6.35mm; box-sizing: border-box;">${b}</div></body></html>`;
    const p = await (await browser.newContext()).newPage();
    await p.setContent(html, { waitUntil: 'load' });
    const pdfBuf = await p.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log(name, 'pdfPages=', pdfDoc.getPageCount());
    await p.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
