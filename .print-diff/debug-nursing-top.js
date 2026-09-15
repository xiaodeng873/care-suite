// 量度「護理及治療記錄」與「生命表徵觀察記錄表」列印頂部高度及頁數
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const { PDFDocument } = require('pdf-lib');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
fs.mkdirSync(stubDir, { recursive: true });

fs.writeFileSync(path.join(stubDir, 'facilitySettings.ts'), `
export interface FacilitySettings {
  facilityNameZh: string; facilityNameEn: string;
  facilityAddressZh: string; facilityAddressEn: string;
  facilityPhone: string; facilityFax: string; logoDataUri: string | null;
}
export const DEFAULT_FACILITY_SETTINGS: FacilitySettings = {
  facilityNameZh: '善頤(福群)護老院', facilityNameEn: '',
  facilityAddressZh: '', facilityAddressEn: '', facilityPhone: '', facilityFax: '', logoDataUri: null,
};
export const getFacilitySettings = async () => DEFAULT_FACILITY_SETTINGS;
`);

fs.writeFileSync(path.join(stubDir, 'supabase.ts'), `
const makeQuery = (table: string) => {
  const q: any = {};
  q.select = () => q;
  q.eq = () => q; q.neq = () => q; q.gte = () => q; q.lte = () => q;
  q.in = () => q; q.order = () => q; q.range = () => q;
  q.then = (resolve: any) => {
    let data: any[] = [];
    if (table === '院友主表') {
      data = [{ 院友id: 999, 中文姓名: '測試院友', 床號: 'A101-1', 性別: '女', 出生日期: '1929-01-01', original_bed_id: null }];
    }
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return q;
};
export const supabase: any = { from: (t: string) => makeQuery(t) };
`);

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
    bundle: true, write: false, format: 'cjs', platform: 'node',
    plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
};

const dummyPatient = {
  院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友',
  床號: 'A101-1', 性別: '女', 出生日期: '1929-01-01', 在住狀態: '在住',
};

(async () => {
  const nursing = await bundle('apps/web/src/utils/patientLogNursingTreatmentGenerator.ts');
  const logs = [];
  for (let i = 0; i < 36; i++) {
    logs.push({
      id: `L${i}`, patient_id: 999,
      log_date: `2025-07-${String((i % 28) + 1).padStart(2, '0')}`,
      log_type: '其他', content: `測試護理內容 ${i}`, recorder: '測試員',
    });
  }
  const nursingHtml = await nursing.generatePatientLogNursingTreatmentHtml(logs, [dummyPatient], logs.map(l => l.id));

  const bp = await bundle('apps/web/src/utils/bloodPressureRecordWorksheetGenerator.ts');
  const bpHtml = await bp.generateBloodPressureRecordHtml('2025-06-01', '2025-12-31', [999], { includeData: false, blankHeader: false });

  const outDir = path.resolve(__dirname, 'gen-out');
  fs.mkdirSync(outDir, { recursive: true });
  const docs = [
    { name: 'nursing_treatment', html: nursingHtml },
    { name: 'vital_signs', html: bpHtml },
  ];

  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext();
  for (const d of docs) {
    const file = path.join(outDir, `debug_${d.name}.html`);
    fs.writeFileSync(file, d.html);
    const page = await ctx.newPage();
    await page.setContent(d.html, { waitUntil: 'load' });
    const measure = await page.evaluate(() => {
      const pxToMm = (px) => (px * 25.4) / 96;
      const pages = Array.from(document.querySelectorAll('.page, .container'));
      const table = document.querySelector('table.main-table');
      return {
        pages: pages.map(p => ({
          top: Math.round(pxToMm(p.getBoundingClientRect().top + window.scrollY) * 10) / 10,
          heightMm: Math.round(pxToMm(p.getBoundingClientRect().height) * 10) / 10,
        })),
        tableTopMm: table ? Math.round(pxToMm(table.getBoundingClientRect().top + window.scrollY) * 10) / 10 : null,
        bodyHeightMm: Math.round(pxToMm(document.body.scrollHeight) * 10) / 10,
      };
    });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    const pdfDoc = await PDFDocument.load(pdfBuf);
    console.log(d.name, JSON.stringify(measure), 'pdfPages=', pdfDoc.getPageCount());
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
