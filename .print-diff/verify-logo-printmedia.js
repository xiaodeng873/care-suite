const path = require('path');
const fs = require('fs');
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
  const logoResult = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const logoMod = { exports: {} };
  new Function('module', 'exports', 'require', logoResult.outputFiles[0].text)(logoMod, logoMod.exports, require);

  const logoSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const html = mod.exports.generatePatrolRoundsRangeHtml({
    bedNumber: 'A101-1', startDate: '2026-09-01', endDate: '2026-09-14',
    rounds: [], facilityName: '善頤(福群)護老院',
  });
  const withLogo = logoMod.exports.injectPageLogo(html, logoSrc);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 794, height: 1123 } })).newPage();
  await page.setContent(withLogo, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  const imgInfo = await page.evaluate(() => {
    const img = document.querySelector('.admission-page-logo');
    const r = img.getBoundingClientRect();
    const pxToMm = (px) => (px * 25.4) / 96;
    return {
      wMm: Math.round(pxToMm(r.width) * 10) / 10,
      hMm: Math.round(pxToMm(r.height) * 10) / 10,
      topMm: Math.round(pxToMm(r.top) * 10) / 10,
      rightPx: Math.round(r.right),
      viewportW: window.innerWidth,
      pos: getComputedStyle(img).position,
    };
  });
  console.log('printMedia imgInfo=', JSON.stringify(imgInfo));
  await page.screenshot({ path: path.join(__dirname, 'gen-out', 'logo_print_check.png'), clip: { x: 500, y: 0, width: 294, height: 220 } });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
