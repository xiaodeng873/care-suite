// 直接載入合併 HTML，檢查 restraint consent 嘅 fitAll 有冇跑、量到咩數
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const inspect = () => {
  const out = {};
  out.fitExists = typeof window.__fitRestraintP1;
  const wrap = document.querySelector('[class*="print-doc-"]:last-of-type');
  out.wrapClass = wrap ? wrap.className : null;
  const scope = document.querySelector('.print-doc-0-16');
  if (!scope) { out.err = 'no scope'; return out; }
  const p1 = scope.querySelector('.page-1');
  const p2 = scope.querySelector('.page-2');
  const inner1 = p1 && p1.querySelector('.a4-container');
  const inner2 = p2 && p2.querySelector('.a4-container');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:1px;height:271mm;';
  document.body.appendChild(probe);
  out.availPx = probe.offsetHeight;
  probe.remove();
  const info = (page, inner) => page && inner ? {
    pageComputedHeight: getComputedStyle(page).height,
    pageInlineHeight: page.style.height || null,
    pageInlineOverflow: page.style.overflow || null,
    innerTransform: inner.style.transform || null,
    innerRectH: Math.round(inner.getBoundingClientRect().height),
    pageRectH: Math.round(page.getBoundingClientRect().height),
    pageWidth: Math.round(page.getBoundingClientRect().width),
    pageBreakAfter: getComputedStyle(page).pageBreakAfter,
    pageBreakInsideBox: getComputedStyle(page.querySelector('.double-border-box') || page).breakInside,
  } : null;
  out.p1 = info(p1, inner1);
  out.p2 = info(p2, inner2);
  out.scopeWidth = Math.round(scope.getBoundingClientRect().width);
  return out;
};

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });

  // 1) 合併版
  const pg = await browser.newPage();
  pg.on('pageerror', (e) => console.log('[bundle pageerror]', e.message));
  const bundleHtml = fs.readFileSync(path.join(__dirname, 'bundle-real-0.html'), 'utf8');
  await pg.setContent(bundleHtml, { waitUntil: 'load', timeout: 60000 });
  await pg.waitForTimeout(2500);
  const bundleInfo = await pg.evaluate(inspect);
  console.log('=== BUNDLE ===');
  console.log(JSON.stringify(bundleInfo, null, 2));

  // 2) 獨立版（淨 restraint consent 一份）
  const pages = JSON.parse(fs.readFileSync(path.join(__dirname, 'bundle-pages.json'), 'utf8'));
  const pg2 = await browser.newPage();
  pg2.on('pageerror', (e) => console.log('[solo pageerror]', e.message));
  await pg2.setContent(pages[16], { waitUntil: 'load', timeout: 60000 });
  await pg2.waitForTimeout(2500);
  const soloInfo = await pg2.evaluate(() => {
    const out = {};
    out.fitExists = typeof window.__fitRestraintP1;
    const p1 = document.querySelector('.page-1');
    const p2 = document.querySelector('.page-2');
    const inner1 = p1 && p1.querySelector('.a4-container');
    const inner2 = p2 && p2.querySelector('.a4-container');
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:1px;height:271mm;';
    document.body.appendChild(probe);
    out.availPx = probe.offsetHeight;
    probe.remove();
    const info = (page, inner) => page && inner ? {
      pageComputedHeight: getComputedStyle(page).height,
      pageInlineHeight: page.style.height || null,
      innerTransform: inner.style.transform || null,
      innerRectH: Math.round(inner.getBoundingClientRect().height),
      pageWidth: Math.round(page.getBoundingClientRect().width),
    } : null;
    out.p1 = info(p1, inner1);
    out.p2 = info(p2, inner2);
    return out;
  });
  console.log('=== SOLO ===');
  console.log(JSON.stringify(soloInfo, null, 2));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
