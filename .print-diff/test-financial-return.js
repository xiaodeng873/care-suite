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

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../apps/web/src/utils/docHtmlGenerators/financialReturnGenerator.ts')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    plugins: [rawPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const html = await mod.exports.generateFinancialReturnHtml({
    patient: {
      院友id: 999,
      中文姓名: '關春杏',
      中文姓氏: '關',
      中文名字: '春杏',
      英文姓名: 'KWAN Chun Hung',
      身份證號碼: 'B645276(6)',
      床號: 'A101-1',
      性別: '女',
      出生日期: '1929-01-01',
      入住日期: '2025-06-06',
    },
    facilityName: '善頤(福群)護老院',
    logoDataUri: null,
    contentMode: 'basic',
  });
  fs.writeFileSync(path.join(__dirname, 'gen-out/financial_return.html'), html);
  console.log('generated financial_return.html');
})();
