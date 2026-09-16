// test-mar-prn-qod：驗證 PRN + 每2日處方喺藥紙顯示「隔日1次」而唔係「每日1次」
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
  },
};

// 攔截 printViaIframe 嘅 doc.write， capturing 產出 HTML
let capturedHtml = '';
const fakeIframe = {
  style: {},
  setAttribute: () => {},
  contentWindow: {
    addEventListener: () => {},
    focus: () => {},
    print: () => {},
    document: {
      open: () => {},
      write: (h) => { capturedHtml += h; },
      close: () => {},
    },
  },
  parentNode: null,
};
global.window = { setTimeout: () => {} };
global.document = {
  createElement: () => fakeIframe,
  body: { appendChild: () => {} },
};

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/medicationRecordHtmlExporter.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { exportSelectedMedicationRecordToHtml } = mod.exports;

  const patient = { 院友id: 1, 中文姓名: '陳大文', 床號: 'A101-2' };
  const prescriptions = [
    {
      id: 'r1', medication_name: 'CLOSTRIDIOPEPTIDASE A OINTMENT 15G', dosage_form: '藥膏',
      administration_route: '外用', frequency_type: 'every_x_days', frequency_value: 2,
      daily_frequency: 1, is_prn: true, medication_time_slots: ['10:00'],
      preparation_method: 'immediate', start_date: '2026-09-14', prescription_date: '2026-09-14',
      status: 'active',
    },
    {
      id: 'r2', medication_name: 'PRN EVERY 3 DAYS DRUG', dosage_form: '藥水',
      administration_route: '口服', frequency_type: 'every_x_days', frequency_value: 3,
      daily_frequency: 2, is_prn: true, medication_time_slots: ['09:00', '21:00'],
      preparation_method: 'immediate', start_date: '2026-09-14', prescription_date: '2026-09-14',
      status: 'active',
    },
    {
      id: 'r3', medication_name: 'PRN EVERY 2 WEEKS DRUG', dosage_form: '藥丸',
      administration_route: '口服', frequency_type: 'every_x_weeks', frequency_value: 2,
      daily_frequency: 1, is_prn: true, medication_time_slots: ['09:00'],
      preparation_method: 'immediate', start_date: '2026-09-14', prescription_date: '2026-09-14',
      status: 'active',
    },
    {
      // 梁寶嫦個案：hourly PRN、無服用時間點、每日次數「無」
      id: 'r4', medication_name: 'TRAMADOL CAP 50MG', dosage_form: '膠囊',
      administration_route: '口服', frequency_type: 'hourly', frequency_value: 6,
      daily_frequency: 0, is_prn: true, medication_time_slots: [],
      dosage_amount: 1, dosage_unit: '粒',
      preparation_method: 'advanced', start_date: '2026-09-14', prescription_date: '2026-09-14',
      status: 'active',
    },
    // 盧葉慧卿個案：每日藥 1 粒 8A + THYROXINE 100MCG 單日 1 粒 8A + 50MCG 雙日 1 粒 8A
    {
      id: 'r5', medication_name: 'DAILY VITAMIN TAB', dosage_form: '藥丸',
      administration_route: '口服', frequency_type: 'daily', frequency_value: 1,
      daily_frequency: 1, is_prn: false, medication_time_slots: ['08:00'],
      dosage_amount: 1, dosage_unit: '粒',
      preparation_method: 'immediate', start_date: '2026-09-14', prescription_date: '2026-09-14',
      status: 'active',
    },
    {
      id: 'r6', medication_name: 'THYROXINE SODIUM TAB 100MCG', dosage_form: '藥丸',
      administration_route: '口服', frequency_type: 'odd_even_days',
      is_odd_even_day: 'odd', daily_frequency: 1, is_prn: false, medication_time_slots: ['08:00'],
      dosage_amount: 1, dosage_unit: '粒',
      preparation_method: 'immediate', start_date: '2026-09-14', prescription_date: '2026-09-14',
      status: 'active',
    },
    {
      id: 'r7', medication_name: 'THYROXINE SODIUM TAB 50MCG', dosage_form: '藥丸',
      administration_route: '口服', frequency_type: 'odd_even_days',
      is_odd_even_day: 'even', daily_frequency: 1, is_prn: false, medication_time_slots: ['08:00'],
      dosage_amount: 1, dosage_unit: '粒',
      preparation_method: 'immediate', start_date: '2026-09-14', prescription_date: '2026-09-14',
      status: 'active',
    },
  ];
  await exportSelectedMedicationRecordToHtml(patient, prescriptions, '2026-09', false, false);
  fs.writeFileSync(path.join(__dirname, 'mar-sample.html'), capturedHtml);

  const stripTags = capturedHtml.replace(/<[^>]+>/g, ' ');
  const checks = [
    ['PRN 隔日 -> 顯示「隔日1次」', stripTags.includes('隔日1次')],
    ['PRN 每3日2次 -> 顯示「每3日2次」', stripTags.includes('每3日2次')],
    ['PRN 每2星期 -> 顯示「每2星期1次」（唔再係每日1次）', stripTags.includes('每2星期1次')],
    ['hourly 處方時間欄冇强行加「每N小時」', !capturedHtml.includes('class="c-time">每6小時<')],
    ['hourly 頻率行「每6小時1次」', stripTags.includes('每6小時1次')],
    ['標籤改名「藥物數量參考」', stripTags.includes('藥物數量參考') && !stripTags.includes('藥物數量統計')],
    ['單雙日互斥：8A 係 (1/2) 唔係 (1/3)', stripTags.includes('8A(1/2)') && !stripTags.includes('8A(1/3)')],
    ['QOD 藥膏冇「每日1次」', !capturedHtml.slice(capturedHtml.indexOf('CLOSTRIDIOPEPTIDASE'), capturedHtml.indexOf('PRN EVERY 3 DAYS')).replace(/<[^>]+>/g, ' ').includes('每日1次')],
    ['有「需要時」', stripTags.includes('需要時')],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
})();
