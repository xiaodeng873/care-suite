// E2E 重現 v3：SPA 內導航，不整頁 reload
import { chromium } from 'playwright-core';

const EXE = 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = 'http://localhost:3000';

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="請輸入帳號"]', { timeout: 20000 });
  await page.fill('input[placeholder="請輸入帳號"]', 'test-roster-admin-1');
  await page.fill('input[placeholder="請輸入密碼"]', 'Test1234');
  await page.click('button:has-text("登入")');

  // 等初始載入完成（左側導覽出現）
  await page.waitForSelector('text=排班管理', { timeout: 60000 });
  console.log('已登入，導覽可見');

  // SPA 內導航：pushState + popstate
  await page.evaluate(() => {
    history.pushState({}, '', '/roster-management');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  // 等員工卡片出現
  await page.waitForSelector('text=譚漢斌', { timeout: 60000 });
  console.log('員工卡片已載入');
  await page.waitForTimeout(2000);

  // 雙擊譚漢斌卡片（JS 觸發，避免 overlay 阻擋）
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d => d.textContent === '譚漢斌');
    if (!el) throw new Error('找不到譚漢斌');
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector('text=僱傭詳情：譚漢斌', { timeout: 15000 });
  console.log('modal 已出現');

  // 等表單載入完成
  const timeInput = page.locator('label:has-text("特定上班時間") + input');
  await timeInput.waitFor({ timeout: 30000 });
  console.log('表單已載入，目前值:', JSON.stringify(await timeInput.inputValue()));

  await timeInput.fill('07:00');
  await page.waitForTimeout(300);
  console.log('填入後 input value:', JSON.stringify(await timeInput.inputValue()));

  await page.locator('button:has-text("儲存僱傭詳情")').click();

  // 等成功或失敗訊息
  const msgLoc = page.locator('text=/僱傭詳情已儲存|儲存僱傭詳情失敗|主檔已儲存|明細同步失敗/');
  await msgLoc.first().waitFor({ timeout: 30000 }).catch(() => console.log('30s 無訊息'));
  console.log('儲存後訊息:', JSON.stringify(await msgLoc.allTextContents()));
  await page.waitForTimeout(3000);
  console.log('儲存後 input value:', JSON.stringify(await timeInput.inputValue().catch(e => '讀取失敗:' + e.message)));
} catch (e) {
  console.error('腳本錯誤:', e.message);
  await page.screenshot({ path: '.tmp/repro_error.png' }).catch(() => {});
} finally {
  console.log('console errors:', JSON.stringify(consoleErrors.slice(0, 10), null, 1));
  await browser.close();
}
