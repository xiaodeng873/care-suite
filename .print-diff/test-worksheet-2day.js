// test-worksheet-2day：驗證監測工作紙 2 天匯出（half / full 兩種版面都唔會再因 daysData[2]/[3] 崩潰）
const path = require('path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    // 優先攔截 generator 直接用嘅 lib/supabase，用帶任務數據嘅本地 stub
    build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: path.join(stubDir, 'supabase-worksheet.ts') }));
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
  },
};

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
  body: { appendChild: () => {}, removeChild: () => {} },
};

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/monitoringTaskWorksheetGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { generateMonitoringTaskWorksheet } = mod.exports;

  const checks = [];
  const countDayHeaders = (html) => (html.match(/a5-page-header|day-header/g) || []).length;

  // half 模式
  capturedHtml = '';
  await generateMonitoringTaskWorksheet(new Date('2026-09-17T00:00:00'), undefined, { layout: 'half' });
  const halfPages = (capturedHtml.match(/<div class="a4-page">/g) || []).length;
  checks.push(['half 模式：唔再崩潰，有輸出 HTML', capturedHtml.length > 1000]);
  checks.push(['half 模式：A4 頁數 >= 1', halfPages >= 1]);
  checks.push(['half 模式：只含 2 天內容（唔再有 Day3/Day4 佔位）', !/Day\s*3|Day\s*4|第三|第四/.test(capturedHtml)]);

  // full 模式：每日有任務 → 每日最少一頁 → 2 天 = 2 張 A4
  capturedHtml = '';
  await generateMonitoringTaskWorksheet(new Date('2026-09-17T00:00:00'), undefined, { layout: 'full' });
  const fullPages = (capturedHtml.match(/<div class="a4-page">/g) || []).length;
  checks.push(['full 模式：唔再崩潰，有輸出 HTML', capturedHtml.length > 1000]);
  checks.push(['full 模式：2 天 = 2 張 A4（每日一頁）', fullPages === 2]);
  checks.push(['full 模式：兩日日期都出現（17/18 或 18/19）', /17\//.test(capturedHtml) && /18\//.test(capturedHtml)]);

  let pass = 0, fail = 0;
  for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); ok ? pass++ : fail++; }

  // ===== 複檢擠壓場景：35 個任務填到用盡，剩餘空間唔夠一行複檢（雙倍行高）→ 成段唔顯示 =====
  globalThis.__WK_TASK_COUNT__ = 35;
  capturedHtml = '';
  await generateMonitoringTaskWorksheet(new Date('2026-09-17T00:00:00'), undefined, { layout: 'half' });
  const hasRecheckHeader = capturedHtml.includes('slot-title-main">複檢');
  console.log(`${!hasRecheckHeader ? 'PASS' : 'FAIL'} 剩餘唔夠一行複檢時：唔會淨係擠個「複檢」表頭落頁尾`);
  !hasRecheckHeader ? pass++ : fail++;

  // 對照：1 個任務（大把空位）→ 複檢應該存在
  globalThis.__WK_TASK_COUNT__ = 1;
  capturedHtml = '';
  await generateMonitoringTaskWorksheet(new Date('2026-09-17T00:00:00'), undefined, { layout: 'half' });
  const hasRecheckWhenRoomy = capturedHtml.includes('slot-title-main">複檢');
  console.log(`${hasRecheckWhenRoomy ? 'PASS' : 'FAIL'} 空位充足時：複檢正常顯示`);
  hasRecheckWhenRoomy ? pass++ : fail++;

  console.log(`\n${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
})();
