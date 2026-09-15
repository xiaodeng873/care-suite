const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  // 直接讀取 grouped 版 html 重建一次並量度各元素位置
  const path2 = require('path');
  const esbuild = require('esbuild');
  const root = path.resolve(__dirname, '..');
  const stubDir = path.resolve(__dirname, 'stubs');
  const stubPlugin = {
    name: 'stubs',
    setup(build) {
      build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
      build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    },
  };
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/patientLogNursingTreatmentGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const dummyPatient = { 院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友', 床號: 'A101-1', 性別: '女', 出生日期: '1929-01-01', 在住狀態: '在住' };
  const logs = [];
  for (let i = 0; i < 35; i++) logs.push({ id: `L${i}`, patient_id: 999, log_date: `2025-07-${String((i % 28) + 1).padStart(2, '0')}`, log_type: '其他', content: `測試護理內容 ${i}`, recorder: '測試員' });
  const docHtml = await mod.exports.generatePatientLogNursingTreatmentHtml(logs, [dummyPatient], logs.map(l => l.id));
  const styles = (docHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).map(t => t.replace(/^<style[^>]*>|<\/style>$/gi, '')).join('\n').replace(/@page[^{]*\{[^}]*\}/g, '');
  const body = docHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].trim();
  const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;}@page{size:A4 portrait;margin:0;}</style><style>${styles}</style></head><body><div class="print-doc-0-0" style="padding: 5mm 6.35mm; box-sizing: border-box;">${body}</div></body></html>`;

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(combined, { waitUntil: 'load' });
  const m = await page.evaluate(() => {
    const pxToMm = (px) => (px * 25.4) / 96;
    const el = document.querySelector('.page');
    const cs = getComputedStyle(el);
    const footer = el.querySelector('.footer');
    const table = el.querySelector('table.main-table');
    const kids = Array.from(el.children).map(c => ({
      cls: c.className, topMm: Math.round(pxToMm(c.getBoundingClientRect().top + window.scrollY) * 100) / 100,
      hMm: Math.round(pxToMm(c.getBoundingClientRect().height) * 100) / 100,
    }));
    return {
      pageTopMm: Math.round(pxToMm(el.getBoundingClientRect().top + window.scrollY) * 100) / 100,
      pageHeightMm: Math.round(pxToMm(el.getBoundingClientRect().height) * 100) / 100,
      pageMinHeight: cs.minHeight,
      footerTopMm: Math.round(pxToMm(footer.getBoundingClientRect().top + window.scrollY) * 100) / 100,
      tableTopMm: Math.round(pxToMm(table.getBoundingClientRect().top + window.scrollY) * 100) / 100,
      bodyScrollMm: Math.round(pxToMm(document.body.scrollHeight) * 100) / 100,
      wrapperScrollMm: Math.round(pxToMm(document.querySelector('.print-doc-0-0').getBoundingClientRect().height) * 100) / 100,
      kids,
    };
  });
  console.log(JSON.stringify(m, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
