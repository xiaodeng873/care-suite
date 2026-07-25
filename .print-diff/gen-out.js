const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rawPlugin = {
  name: 'raw-html',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw-ns',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw-ns' }, async (args) => {
      const text = await fs.promises.readFile(args.path, 'utf8');
      return { contents: text, loader: 'text' };
    });
  },
};

const outDir = path.resolve(__dirname, 'gen-out');
fs.mkdirSync(outDir, { recursive: true });

const dummyPatient = {
  院友id: 999,
  中文姓名: '測試院友',
  中文姓氏: '測',
  中文名字: '試院友',
  英文姓名: 'Test Patient',
  英文姓氏: 'Test',
  英文名字: 'Patient',
  身份證號碼: 'A123456(7)',
  床號: 'A101-1',
  性別: '女',
  出生日期: '1929-01-01',
  入住日期: '2025-06-06',
  退住日期: '',
  通訊電話: '',
  通訊地址: '',
  從前主要職業: '',
  教育程度: '',
  婚姻狀況: '',
  宗教信仰: '',
  在住狀態: '在住',
};

const dummyCtx = {
  patient: dummyPatient,
  startDate: '2025-06-06',
  endDate: '2025-12-31',
  facilityName: '善頤(福群)護老院',
  logoDataUri: null,
  contentMode: 'basic',
};

const generators = [
  { file: '../apps/web/src/utils/docHtmlGenerators/outingConsentGenerator.ts', fn: 'generateOutingConsentHtml', name: 'outing' },
  { file: '../apps/web/src/utils/docHtmlGenerators/financialReturnGenerator.ts', fn: 'generateFinancialReturnHtml', name: 'financial_return' },
  { file: '../apps/web/src/utils/docHtmlGenerators/personalHealthRecordGenerator.ts', fn: 'generatePersonalHealthRecordHtml', name: 'personal_health_record' },
  { file: '../apps/web/src/utils/docHtmlGenerators/orientationPlanGenerator.ts', fn: 'generateOrientationPlanHtml', name: 'orientation_plan' },
  { file: '../apps/web/src/utils/docHtmlGenerators/publicityConsentGenerator.ts', fn: 'generatePublicityConsentHtml', name: 'publicity_consent' },
  { file: '../apps/web/src/utils/docHtmlGenerators/personalBelongingsGenerator.ts', fn: 'generatePersonalBelongingsHtml', name: 'personal_belongings' },
  { file: '../apps/web/src/utils/docHtmlGenerators/financialProxyGenerator.ts', fn: 'generateFinancialProxyP1Html', name: 'financial_proxy_p1' },
  { file: '../apps/web/src/utils/docHtmlGenerators/financialProxyGenerator.ts', fn: 'generateFinancialProxyP2Html', name: 'financial_proxy_p2' },
  { file: '../apps/web/src/utils/docHtmlGenerators/medicationProxyGenerator.ts', fn: 'generateMedicationProxyHtml', name: 'medication_proxy' },
  { file: '../apps/web/src/utils/docHtmlGenerators/selfMedicationGenerator.ts', fn: 'generateSelfMedicationHtml', name: 'self_medication' },
  { file: '../apps/web/src/utils/docHtmlGenerators/doctorVisitGenerator.ts', fn: 'generateDoctorVisitHtml', name: 'doctor_visit' },
];

(async () => {
  for (const g of generators) {
    try {
      const result = await esbuild.build({
        entryPoints: [path.resolve(__dirname, g.file)],
        bundle: true,
        write: false,
        format: 'cjs',
        platform: 'node',
        plugins: [rawPlugin],
      });
      const mod = { exports: {} };
      new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
      const fn = mod.exports[g.fn];
      const html = await fn(dummyCtx);
      fs.writeFileSync(path.join(outDir, `${g.name}.html`), html);
      console.log('generated', g.name);
    } catch (e) {
      console.error('failed', g.name, e.message);
    }
  }
})();
