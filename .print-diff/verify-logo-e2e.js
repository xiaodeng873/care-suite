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

  // 1x1 紅色 png data uri 當 logo
  const logoSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const html = mod.exports.generatePatrolRoundsRangeHtml({
    bedNumber: 'A101-1',
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    rounds: [],
    facilityName: '善頤(福群)護老院',
  });
  const logoResult = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const logoMod = { exports: {} };
  new Function('module', 'exports', 'require', logoResult.outputFiles[0].text)(logoMod, logoMod.exports, require);
  const { injectPageLogo } = logoMod.exports;
  const withLogo = injectPageLogo(html, logoSrc);
  const logoCssOk = withLogo.includes('width:48mm');
  const imgCount = (withLogo.match(/admission-page-logo/g) || []).length;

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext()).newPage();
  await page.setContent(withLogo, { waitUntil: 'load' });
  const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
  console.log('logoCss48mm=', logoCssOk, 'imgTagCount=', imgCount, 'pdfPages=', doc.numPages);
  for (let p = 1; p <= doc.numPages; p++) {
    const pdfPage = await doc.getPage(p);
    const ops = await pdfPage.getOperatorList();
    let images = 0;
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (String(ops.fnArray[i]).includes('paintImage')) images++;
    }
    console.log(`page ${p}: image ops = ${images}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
