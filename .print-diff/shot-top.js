const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve(__dirname, 'gen-out');

(async () => {
  const files = ['debug_nursing_treatment', 'debug_vital_signs'];
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  for (const name of files) {
    const page = await ctx.newPage();
    await page.goto('file:///' + path.join(outDir, name + '.html').replace(/\\/g, '/'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, name + '_top.png'), clip: { x: 0, y: 0, width: 794, height: 420 } });
    await page.close();
    console.log('shot', name);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
