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
  // 檢查 img 有載入、位置、尺寸
  const imgInfo = await page.evaluate(() => {
    const img = document.querySelector('.admission-page-logo');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { complete: img.complete, w: r.width, h: r.height, top: r.top, right: r.right, display: getComputedStyle(img).display, pos: getComputedStyle(img).position, mediaWidth: getComputedStyle(img).width };
  });
  console.log('imgInfo=', JSON.stringify(imgInfo));
  // 截圖（screen media，print CSS 不影響 img 渲染，position fixed 仍會顯示）
  await page.screenshot({ path: path.join(__dirname, 'gen-out', 'logo_check.png'), clip: { x: 500, y: 0, width: 294, height: 200 } });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
