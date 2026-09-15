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
    entryPoints: [path.join(root, 'apps/web/src/utils/diaperRecordPrintFormHtml.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);

  const logoSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const html = mod.exports.generateDiaperRecordFormForDateRange(
    { 院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試', 床號: 'A101-1' },
    [], '2026-09-01', '2026-09-04', '善頤(福群)護老院', false
  );

  const browser = await chromium.launch({ executablePath: CHROME });
  for (const topVal of ['-4mm', '0mm', '2mm', '9mm']) {
    const css = `<style>@media print{.admission-page-logo{position:fixed;top:${topVal};${topVal === '9mm' ? 'transform:translateY(-50%);' : ''}right:2mm;width:32mm;height:11.5mm;z-index:2147483647;}}</style>`;
    const withLogo = html.replace('</head>', css + '</head>').replace(/<body([^>]*)>/i, `<body$1><img class="admission-page-logo" src="${logoSrc}">`);
    const page = await (await browser.newContext({ viewport: { width: 1123, height: 794 } })).newPage();
    await page.setContent(withLogo, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    const m = await page.evaluate(() => {
      const pxToMm = (px) => (px * 25.4) / 96;
      const logo = document.querySelector('.admission-page-logo').getBoundingClientRect();
      const title = document.querySelector('.inst').getBoundingClientRect();
      return {
        logoTopMm: Math.round(pxToMm(logo.top) * 10) / 10,
        logoCenterMm: Math.round(pxToMm(logo.top + logo.height / 2) * 10) / 10,
        titleTopMm: Math.round(pxToMm(title.top) * 10) / 10,
        titleCenterMm: Math.round(pxToMm(title.top + title.height / 2) * 10) / 10,
      };
    });
    console.log(`top=${topVal}`, JSON.stringify(m));
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
