const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
(async () => {
  const pages = JSON.parse(fs.readFileSync(path.join(__dirname, 'bundle-pages.json'), 'utf8'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const pg = await browser.newPage();
  await pg.setContent(pages[0], { waitUntil: 'load' });
  await pg.waitForTimeout(1500);
  await pg.pdf({ path: path.join(__dirname, 'restraint-check.pdf'), preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('ok');
})();
