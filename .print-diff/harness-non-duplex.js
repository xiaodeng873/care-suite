// 重現「入住文件非雙面列印」嘅合併 HTML，capture 後用 playwright 截圖驗證
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');

const rawPlugin = {
  name: 'raw',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw-file',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw-file' }, async (args) => ({
      contents: await fs.promises.readFile(args.path, 'utf8'),
      loader: 'text',
    }));
  },
};

const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
  },
};

let captured = '';
const fakeIframe = {
  id: '', style: {},
  setAttribute: () => {},
  contentWindow: {
    addEventListener: () => {}, removeEventListener: () => {},
    focus: () => {}, print: () => {},
    document: {
      open: () => {}, close: () => {},
      write: (h) => { captured += h; },
      getElementById: () => null,
      readyState: 'complete',
    },
  },
};
global.window = { setTimeout: (fn) => {} };
global.document = {
  createElement: () => fakeIframe,
  getElementById: () => null,
  body: { appendChild: () => {}, contains: () => false },
};

(async () => {
    // 直接攞 decorator 同 printGroupedHtml：重新由模組攞（同模組內部使用一致）
  const utils = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/punchGuide.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const umod = { exports: {} };
  new Function('module', 'exports', 'require', utils.outputFiles[0].text)(umod, umod.exports, require);

  const logoUtils = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const lmod = { exports: {} };
  new Function('module', 'exports', 'require', logoUtils.outputFiles[0].text)(lmod, lmod.exports, require);

  const printUtils = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printUtils.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const pmod = { exports: {} };
  new Function('module', 'exports', 'require', printUtils.outputFiles[0].text)(pmod, pmod.exports, require);

  const patient = {
    院友id: 1, 中文姓名: '關春杏', 中文姓氏: '關', 中文名字: '春杏',
    英文姓名: 'WAN Chun Hung', 身份證號碼: 'B640278(6)', 出生日期: '1929-01-01',
    入住日期: '2025-01-05', 性別: '女', 教育程度: '小學', 婚姻狀況: '已婚',
    宗教信仰: '基督教', 藥物敏感: [], 從前主要職業: '家務', 床號: 'A101-1',
  };
  const ctx = {
    patient, startDate: '2026-09-01', endDate: '2026-09-30',
    facilityName: '善頤(福群)護老院', contentMode: 'basic',
  };

  const phr = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/docHtmlGenerators/personalHealthRecordGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [rawPlugin, stubPlugin],
  });
  const hmod = { exports: {} };
  new Function('module', 'exports', 'require', phr.outputFiles[0].text)(hmod, hmod.exports, require);
  const html = await hmod.exports.generatePersonalHealthRecordHtml(ctx);

  // 同 bundle decorate 一樣：先打孔後 logo
  const decorated = lmod.exports.injectPageLogo(umod.exports.injectPunchGuide(html), '/sc-logo.png');

  // 用真 printGroupedHtml capture 合併 HTML（非雙面）
  captured = '';
  pmod.exports.printGroupedHtml([decorated], 'harness-iframe', false);
  const combined = captured;
  const outPath = path.join(root, '.print-diff/harness-non_duplex_health_record.html');
  fs.writeFileSync(outPath, combined, 'utf8');
  console.log('combined written:', outPath, combined.length, 'chars');
  console.log('has punch:', combined.includes('punch-guide-fixed'));
  console.log('named page rules:', (combined.match(/@page pg-/g) || []).length);
})();
