// debug：screen layout（含/不含 .no-print）量到嘅標題字頂偏移 vs print layout 實際值
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
const px2mm = (px) => (px * 25.4) / 96;

(async () => {
  const html = fs.readFileSync(path.join(root, 'upload/doc_html/院友護理評估記錄.html'), 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME });
  for (const vpSize of [{ width: 320, height: 200 }, { width: 900, height: 700 }]) {
    const page = await (await browser.newContext({ viewport: vpSize })).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const m = await page.evaluate(() => {
      const px2mmLocal = (px) => (px * 25.4) / 96;
      const h1 = document.querySelector('h1');
      const range = document.createRange();
      range.setStart(h1.firstChild, 0);
      range.setEnd(h1.firstChild, 1);
      const r = range.getBoundingClientRect();
      const np = document.querySelector('.no-print');
      return {
        vp: window.innerWidth,
        rangeTopMm: px2mmLocal(r.top),
        rangeHMm: px2mmLocal(r.height),
        h1TopMm: px2mmLocal(h1.getBoundingClientRect().top),
        noPrintVisible: np ? getComputedStyle(np).display : 'none',
        bodyMargin: getComputedStyle(document.body).margin,
        h1Lh: getComputedStyle(h1).lineHeight,
        h1Fs: getComputedStyle(h1).fontSize,
        fontFamily: getComputedStyle(h1).fontFamily,
        firstFont: document.fonts ? document.fonts.size : -1,
      };
    });
    console.log(JSON.stringify(m));
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
