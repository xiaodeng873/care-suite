// 重現「入住文件批次非雙面列印」：4 份文件（同真實 app 一樣每份獨立 decorate），
// capture printGroupedHtml 合併 HTML，之後用 shot-batch.mjs 行 padOddPageDocuments + PDF
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

const load = async (entry) => {
  const r = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true, write: false, format: 'cjs', platform: 'node',
    plugins: [rawPlugin, stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', r.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
};

(async () => {
  const umod = await load('apps/web/src/utils/punchGuide.ts');
  const lmod = await load('apps/web/src/utils/printPageLogo.ts');
  const pmod = await load('apps/web/src/utils/printUtils.ts');

  const patient = {
    院友id: 1, 中文姓名: '關春杏', 中文姓氏: '關', 中文名字: '春杏',
    英文姓名: 'WAN Chun Hung', 身份證號碼: 'B640278(6)', 出生日期: '1929-01-01',
    入住日期: '2025-01-05', 性別: '女', 教育程度: '小學', 婚姻狀況: '已婚',
    宗教信仰: '基督教', 藥物敏感: [], 從前主要職業: '家務', 床號: 'A101-1',
  };
  const episodes = Array.from({ length: 14 }, (_, i) => ({
    patient_id: 1,
    episode_start_date: `2026-0${(i % 8) + 1}-1${i % 9}`,
    episode_end_date: `2026-0${(i % 8) + 1}-2${i % 9}`,
    primary_hospital: '伊利沙伯醫院', primary_ward: 'A3', primary_bed_number: String(i + 1), remarks: '',
  }));
  const ctx = {
    patient, startDate: '2026-09-01', endDate: '2026-09-30',
    facilityName: '善頤(福群)護老院', contentMode: 'basic',
  };

  const genEntries = [
    'apps/web/src/utils/docHtmlGenerators/personalHealthRecordGenerator.ts',
    'apps/web/src/utils/docHtmlGenerators/nursingAssessmentGenerator.ts',
    'apps/web/src/utils/docHtmlGenerators/financialProxyGenerator.ts',
    'apps/web/src/utils/docHtmlGenerators/publicityConsentGenerator.ts',
    'apps/web/src/utils/erRecordPrintGenerator.ts',
    'apps/web/src/utils/healthAssessmentPrintGenerator.ts',
    'apps/web/src/utils/activityRecordPrintFormHtml.ts',
  ];
  const names = ['health_record', 'nursing_assessment', 'financial_proxy', 'publicity_consent', 'er_record', 'health_assessment', 'activity_record'];

  const docs = [];
  for (let i = 0; i < genEntries.length; i++) {
    const g = await load(genEntries[i]);
    const key = Object.keys(g).find((k) => typeof g[k] === 'function' && k.startsWith('generate'));
    let html;
    if (i === 4) {
      html = g.generateERRecordFormsHtml(episodes, [patient], '善頤(福群)護老院');
    } else if (i === 5) {
      html = g.generateHealthAssessmentHtml({}, patient, '善頤(福群)護老院');
    } else if (i === 6) {
      html = g.generateActivityRecordPrintFormHtml([patient], new Map([[patient.院友id, []]]), '善頤(福群)護老院');
    } else {
      html = await g[key](ctx);
    }
    // 同 bundle decorate 一樣：先 logo（margin 歸零）後打孔（讀取歸零後 margin）
    const decorated = umod.injectPunchGuide(lmod.injectPageLogo(html, '/sc-logo.png'));
    docs.push(decorated);
    console.log(names[i], 'raw', html.length, '-> decorated', decorated.length,
      'punch:', decorated.includes('punch-guide-fixed'), 'logo:', decorated.includes('admission-page-logo'));
  }

  captured = '';
  pmod.printGroupedHtml(docs, 'harness-iframe', false);
  const combined = captured;
  const outPath = path.join(root, '.print-diff/harness-batch-nonduplex.html');
  fs.writeFileSync(outPath, combined, 'utf8');
  console.log('combined written:', outPath, combined.length, 'chars');
  console.log('named page rules:', (combined.match(/@page pg-/g) || []).length);
  console.log((combined.match(/@page pg-[^}]+}/g) || []).join('\n'));
  // 記低每份文件原 html 嘅 pageConfig（shot 腳本 padOddPageDocuments 要用）
  const configs = docs.map((d) => pmod.extractPageConfig(d));
  fs.writeFileSync(path.join(root, '.print-diff/harness-batch-configs.json'), JSON.stringify(configs, null, 2));
  console.log('configs:', JSON.stringify(configs));
})();
