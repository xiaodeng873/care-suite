// repro-bundle-capture：用真實 generatePatientPrintBundle + printGroupedHtml，
// 以假 DOM 截獲合併後嘅 HTML，再用 Chrome 截圖對比
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');

const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: path.join(stubDir, 'supabase-js.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
    build.onResolve({ filter: /facilitySettings/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
  },
};

// ── 假 DOM：截獲 printGroupedHtml 寫入 iframe 嘅 HTML ──
const captured = [];
global.window = global;
global.document = {
  getElementById: () => null,
  createElement: (tag) => {
    if (tag !== 'iframe') return { style: {}, remove() {}, setAttribute() {}, appendChild() {} };
    const fake = {
      style: {},
      id: '',
      remove() {},
      addEventListener() {},
      contentWindow: null,
    };
    const win = {
      document: null,
      addEventListener() {},
      removeEventListener() {},
      focus() {},
      print() {},
      fonts: { ready: Promise.resolve() },
    };
    const idoc = {
      open() { this._buf = ''; },
      write(s) { this._buf = (this._buf || '') + s; },
      close() { captured.push(this._buf); },
      readyState: 'complete',
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, remove() {}, appendChild() {}, getBoundingClientRect: () => ({ height: 0 }) }),
      body: { appendChild() {} },
    };
    win.document = idoc;
    fake.contentWindow = win;
    return fake;
  },
  body: { appendChild() {}, contains: () => true },
  fonts: { ready: Promise.resolve() },
};
global.URL = global.URL || {};
global.Blob = global.Blob || class {};
global.HTMLAnchorElement = class {};
global.HTMLCanvasElement = class {};
global.navigator = global.navigator || { userAgent: 'node' };
global.alert = (...args) => console.log('[alert]', ...args);
global.confirm = () => true;

(async () => {
  const r = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/patientPrintBundleGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node',
    plugins: [stubPlugin],
    loader: { '.html': 'text' },
    define: {
      'import.meta.env.BASE_URL': "'/'",
      'import.meta.env.MODE': "'production'",
      'import.meta.env.VITE_SUPABASE_URL': "''",
      'import.meta.env.VITE_SUPABASE_ANON_KEY': "''",
      'import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY': "''",
    },
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', r.outputFiles[0].text)(mod, mod.exports, require);
  const bundle = mod.exports;

  const patient = {
    院友id: 999, 中文姓名: '李玉嬋', 中文姓氏: '李', 中文名字: '玉嬋',
    性別: '女', 出生日期: '1932-05-01', 身份證號碼: 'B727108(0)',
    床號: 'A101-2', 入住日期: '2025-01-01',
  };

  // 全選入住文件 + 常用表格（模擬用戶全選情境）
  const documentIds = process.argv[2]
    ? process.argv[2].split(',')
    : ['restraint_consent'];

  await bundle.generatePatientPrintBundle({
    patients: [patient],
    documentIds,
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    contentMode: 'basic',
    printOptions: { duplexPadding: false },
  });

  // 等所有 setTimeout 鏈完成
  await new Promise((r2) => setTimeout(r2, 8000));

  console.log(`captured ${captured.length} iframe(s)`);
  captured.forEach((html, i) => {
    const f = path.join(__dirname, `bundle-real-${i}.html`);
    fs.writeFileSync(f, html);
    console.log(`written ${f} (${html.length} bytes)`);
  });
})();
