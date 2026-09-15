const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
  },
};
(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/patrolRoundsHtmlExporter.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const html = mod.exports.generatePatrolRoundsRangeHtml({
    bedNumber: 'A101-1', startDate: '2026-09-01', endDate: '2026-09-20',
    rounds: [], facilityName: '善頤(福群)護老院',
  });
  const withLogo = html.replace('</head>', '<style>@media print{.admission-page-logo{position:fixed;top:9mm;right:2mm;transform:translateY(-50%);width:32mm;height:11.5mm;}}</style></head>').replace(/<body([^>]*)>/i, '<body$1><img class="admission-page-logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==">');
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(withLogo, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  const pdfPage = await doc.getPage(1);
  const ops = await pdfPage.getOperatorList();
  console.log('unique ops:', [...new Set(ops.fnArray.map(String))].join(', '));
})();
