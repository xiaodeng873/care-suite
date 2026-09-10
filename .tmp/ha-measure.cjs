const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 1200 } });
  await page.goto('file:///C:/Users/Admin/Desktop/care-suite/.tmp/ha-test.html');
  await page.waitForTimeout(500);
  const heights = await page.evaluate(() => {
    // 模擬 A4 可打印寬度：210mm - 2×0.25in ≈ 755.6px
    document.body.style.width = '755.6px';
    const pages = Array.from(document.querySelectorAll('.print-page'));
    pages.forEach(p => { p.style.minHeight = '0'; });
    return pages.map((p, i) => {
      const h = p.getBoundingClientRect().height;
      return { page: i + 1, px: Math.round(h * 10) / 10, mm: Math.round(h / 3.7795 * 10) / 10 };
    });
  });
  const limitPx = 287 * 3.7795;
  console.log('limit:', Math.round(limitPx * 10) / 10, 'px / 287mm');
  for (const h of heights) {
    console.log(`page ${h.page}: ${h.px}px = ${h.mm}mm ${h.px > limitPx ? '❌ 超 ' + Math.round((h.px - limitPx) / 3.7795 * 10) / 10 + 'mm' : '✓'}`);
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
