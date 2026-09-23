// step 1：截獲 generatePatientPrintBundle 產生嘅 pages[]（未合併），落 JSON
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');

// printUtils stub：真嘢照 export，只截 printGroupedHtml 嘅 pages
fs.writeFileSync(path.join(stubDir, 'printUtils-capture.ts'), `
export * from 'real-print-utils';
export const printGroupedHtml = (pages: string[]) => { (globalThis as any).__capturedPages = pages; };
export const printCombinedHtml = (pages: string[]) => { (globalThis as any).__capturedPages = pages; };
`);

const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /^real-print-utils$/ }, () => ({ path: path.join(root, 'apps/web/src/utils/printUtils.ts') }));
    build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: path.join(stubDir, 'supabase-js.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
    build.onResolve({ filter: /facilitySettings/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)printUtils$/ }, () => ({ path: path.join(stubDir, 'printUtils-capture.ts') }));
  },
};

global.window = global;
global.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, remove() {}, setAttribute() {}, appendChild() {} }),
  body: { appendChild() {}, contains: () => true },
  fonts: { ready: Promise.resolve() },
};
global.HTMLAnchorElement = class {};
global.HTMLCanvasElement = class {};
global.navigator = global.navigator || { userAgent: 'node' };
global.alert = () => {};

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

  const patient = {
    院友id: 999, 中文姓名: '李玉嬋', 中文姓氏: '李', 中文名字: '玉嬋',
    性別: '女', 出生日期: '1932-05-01', 身份證號碼: 'B727108(0)',
    床號: 'A101-2', 入住日期: '2025-01-01',
  };
  const documentIds = process.argv[2].split(',');

  await mod.exports.generatePatientPrintBundle({
    patients: [patient],
    documentIds,
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    contentMode: 'basic',
    printOptions: { duplexPadding: true },
  });

  const pages = global.__capturedPages || [];
  fs.writeFileSync(path.join(__dirname, 'bundle-pages.json'), JSON.stringify(pages));
  console.log('captured pages:', pages.length);
})();
