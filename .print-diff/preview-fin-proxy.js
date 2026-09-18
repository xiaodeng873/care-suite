// 託管院友財物授權書（合併版）+ 打孔指引預覽：真 generator + ?raw template
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
  },
};

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/docHtmlGenerators/financialProxyGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node',
    plugins: [rawPlugin, stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { generateFinancialProxyHtml } = mod.exports;

  const ctx = {
    patient: { 院友id: 1, 中文姓名: '李玉嬋', 身份證號碼: 'B727108(0)' },
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    facilityName: '善頤(福群)護老院',
    contentMode: 'basic',
  };
  const html = await generateFinancialProxyHtml(ctx);

  // 模擬 bundle 中央注入：入住文件 category → injectPunchGuide + injectPageLogo
  const punch = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/punchGuide.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node',
    plugins: [stubPlugin],
  });
  const pmod = { exports: {} };
  new Function('module', 'exports', 'require', punch.outputFiles[0].text)(pmod, pmod.exports, require);

  const out = pmod.exports.injectPunchGuide(html);

  const previewCss = `<style>
@media screen {
  body { background: #d0d0d0 !important; padding: 10mm 0; }
  [class*="doc-page-"] { background: #fff; box-shadow: 0 0 4mm rgba(0,0,0,.4); margin: 0 0 10mm 25mm; width: 210mm; }
}
</style>`;
  const finalOut = out.replace(/<\/head>/i, `${previewCss}</head>`);
  const outPath = path.join(root, 'scripts/previews/financial_proxy_merged_preview.html');
  fs.writeFileSync(outPath, finalOut, 'utf8');
  console.log('written:', outPath);
  console.log('pages:', (finalOut.match(/doc-page-/g) || []).length);
  console.log('has punch:', finalOut.includes('punch-guide-fixed'));
  console.log('page margin:', (finalOut.match(/@page[^{]*\{[^}]*margin[^;}]*;?/i) || ['none'])[0]);
})();
