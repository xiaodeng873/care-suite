const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
(async () => {
  const js = fs.readFileSync(path.resolve(__dirname, 'pu-bundle.js'), 'utf8');
  const pages = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'bundle-pages.json'), 'utf8'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('about:blank');
  await page.addScriptTag({ content: js });
  const t = await page.evaluate(() => typeof window.PrintUtils + ' ' + Object.keys(window.PrintUtils || {}).join(','));
  console.log('PrintUtils:', t);
  try {
    await page.evaluate((p) => window.PrintUtils.printGroupedHtml(p, 'test-iframe', true), pages.slice(0, 3));
    await page.waitForTimeout(3000);
    const has = await page.evaluate(() => !!document.getElementById('test-iframe'));
    console.log('iframe exists:', has);
  } catch (e) { console.log('call error:', e.message); }
  await browser.close();
})();
