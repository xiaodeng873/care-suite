const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto('file:///C:/Users/Admin/Desktop/care-suite/.tmp/vacc-test.html');
  await page.waitForTimeout(400);
  await page.pdf({ path: '.tmp/vacc-test.pdf', format: 'A4', printBackground: true });
  await browser.close();
  // 數頁數：統計 /Type /Page 出現次數（非 /Pages）
  const fs = require('fs');
  const buf = fs.readFileSync('.tmp/vacc-test.pdf');
  const m = buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  console.log('PDF 頁數 =', m ? m.length : 'unknown');
})().catch(e => { console.error(e.message); process.exit(1); });
