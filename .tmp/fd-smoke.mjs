import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const dist = path.resolve('apps/marketing/dist');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith(path.sep) || req.url === '/') p = path.join(p, 'features.html');
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(4891, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://localhost:4891/features.html');
await page.waitForTimeout(500);

const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

// All 13 frames rendered
for (const id of ['dashboard','emar','roster','leave','beds','vitals','ocr','ai','wound','print','reports','permissions','mobile']) {
  const len = await page.locator('#demo-' + id).evaluate(el => el.innerHTML.length);
  check('render ' + id, len > 200, len + ' chars');
}

// 1. Dashboard: open card, fill, save, progress updates
await page.click('[data-task="t1"]');
await page.waitForSelector('.fd-modal input[data-idx]');
const before = await page.locator('[data-task="t1"]').innerText();
await page.locator('.fd-modal input[data-idx]').first().fill('36.8');
await page.click('.fd-modal [data-act="save"]');
await page.waitForTimeout(200);
const after = await page.locator('[data-task="t1"]').innerText();
check('dashboard worksheet save', before !== after, `${before.match(/\d \/ \d/)?.[0]} -> ${after.match(/\d+ \/ \d+/)?.[0]}`);

// 2. eMAR: three steps chained
await page.click('[data-res="1"]');
const prepBtn = page.locator('[data-step="prep"]');
await prepBtn.click();
await page.waitForSelector('#fd-sign-name');
await page.click('[data-act="ok"]');
await page.waitForTimeout(200);
const checkEnabled = await page.locator('[data-step="check"]').isEnabled();
const giveDisabled = await page.locator('[data-step="give"]').isDisabled();
check('emar step chaining', checkEnabled && giveDisabled);
await page.click('[data-step="check"]');
await page.waitForSelector('#fd-sign-name');
await page.click('[data-act="ok"]');
await page.waitForTimeout(200);
check('emar give enabled after check', await page.locator('[data-step="give"]').isEnabled());
// QR scan jumps resident
await page.click('[data-act="qr"]');
await page.waitForTimeout(1700);
check('emar qr scan switches resident', await page.locator('.fd-res-item.is-active').innerText().then(t => !t.includes('陳大文')));
// fail reason modal
await page.click('[data-act="fail"]');
await page.waitForSelector('input[name="fd-fail"]');
await page.click('.fd-modal [data-act="ok"]');
await page.waitForTimeout(200);
check('emar fail recorded', (await page.locator('#demo-emar').innerText()).includes('拒服'));

// 3. Roster: chips draggable + conflict detection via HTML5 DnD events
const rosterHasChips = await page.locator('.fd-chip[draggable="true"]').count();
check('roster chips', rosterHasChips > 10, rosterHasChips + ' chips');
// simulate drop: dispatch dragstart/drop with DataTransfer
const conflict = await page.evaluate(() => {
  const chip = document.querySelector('.fd-chip[data-emp="0"][data-day="0"]');
  const cell = document.querySelector('.fd-cell[data-emp="0"][data-day="2"]'); // 陳婉儀 星期三已有 P → 兩更衝突
  const dt = new DataTransfer();
  chip.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
  cell.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
  cell.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  const banner = document.querySelector('#demo-roster .fd-banner');
  return banner ? banner.innerText : '';
});
check('roster conflict banner', conflict.includes('排班衝突') && conflict.includes('陳婉儀'), conflict.slice(0, 60));

// 4. Leave: click empty cell, pick 年假, balance decrements
const balBefore = await page.locator('#demo-leave').innerText();
await page.click('.fd-leave-cell[data-emp="1"][data-day="2"]');
await page.waitForSelector('[data-leave="AL"]');
await page.click('[data-leave="AL"]');
await page.waitForTimeout(200);
const leaveText = await page.locator('#demo-leave').innerText();
check('leave add + balance', leaveText.includes('李志豪：年假餘 7 日'), '');
// conflict: put leave on a shift day
await page.click('.fd-leave-cell[data-emp="0"][data-day="1"]'); // shift A
await page.waitForSelector('[data-leave="RO"]');
await page.click('[data-leave="RO"]');
await page.waitForTimeout(200);
const leaveText2 = await page.locator('#demo-leave').innerText();
check('leave conflict hint', leaveText2.includes('衝突') || leaveText2.includes('請先調更'), '');

// 5. Beds: open resident, swap with empty bed, log grows
await page.click('.fd-bed.occupied >> nth=0');
await page.waitForSelector('.fd-modal [data-act="swap"]');
await page.click('.fd-modal [data-act="swap"]');
await page.waitForTimeout(200);
await page.click('.fd-bed.empty >> nth=0');
await page.waitForTimeout(200);
const bedLog = await page.locator('#demo-beds .fd-log').innerText();
check('bed swap logged', bedLog.includes('⇄'), bedLog.split('\n')[0]);

// 6. Vitals: abnormal highlight + save timestamps
await page.fill('input[data-row="0"][data-field="temp"]', '38.6');
await page.dispatchEvent('input[data-row="0"][data-field="temp"]', 'input');
check('vitals abnormal class', await page.locator('input[data-row="0"][data-field="temp"].is-bad').count() === 1);
check('vitals warning note', (await page.locator('#demo-vitals').innerText()).includes('體溫異常'));
await page.click('#demo-vitals [data-act="save"]');
await page.waitForTimeout(200);
check('vitals save toast', await page.locator('.fd-toast').innerText().then(t => t.includes('已儲存')));

// 7. OCR: scan fills form; second scan = duplicate warning
await page.click('#demo-ocr [data-act="scan"]');
await page.waitForTimeout(1700);
check('ocr autofill', await page.locator('#ocr-name').inputValue() === '黃麗珍');
await page.click('#demo-ocr [data-act="scan"]');
await page.waitForTimeout(1700);
check('ocr duplicate warning', (await page.locator('#ocr-warning').innerText()).includes('重複建檔'));
await page.click('#demo-ocr [data-act="submit"]');
await page.waitForTimeout(200);
check('ocr duplicate blocked', (await page.locator('.fd-toast').innerText()).includes('重複'));

// 8. AI: intents + confirm card + upload OCR
await page.fill('#ai-input', '今日仲有邊個未量體溫？');
await page.click('#demo-ai [data-act="send"]');
await page.waitForTimeout(600);
check('ai temp intent', (await page.locator('#ai-log').innerText()).includes('未量'));
await page.fill('#ai-input', '幫陳大文加個覆診');
await page.click('#demo-ai [data-act="send"]');
await page.waitForTimeout(600);
await page.click('[data-ai-confirm]');
await page.waitForTimeout(200);
check('ai confirm card', (await page.locator('#ai-log').innerText()).includes('已為 陳大文 新增覆診'));
await page.click('#demo-ai [data-act="upload"]');
await page.waitForTimeout(1700);
check('ai upload ocr', (await page.locator('#ai-log').innerText()).includes('比對結果'));
await page.fill('#ai-input', 'asdfgh');
await page.click('#demo-ai [data-act="send"]');
await page.waitForTimeout(600);
check('ai fallback', (await page.locator('#ai-log').innerText()).includes('示範版本'));

// 9. Wound: click part, save, list grows; injection mode
const woundRowsBefore = await page.locator('#demo-wound tbody tr').count();
await page.click('.fd-body-part[data-part="胸腹"]');
await page.waitForSelector('#w-id');
await page.click('.fd-modal [data-act="ok"]');
await page.waitForTimeout(200);
check('wound add', await page.locator('#demo-wound tbody tr').count() === woundRowsBefore + 1);
check('wound overdue red', (await page.locator('#demo-wound').innerText()).includes('每週評估逾期'));
await page.click('[data-mode="injection"]');
await page.click('.fd-body-part[data-part="右手臂"]');
await page.waitForSelector('#i-med');
await page.click('.fd-modal [data-act="ok"]');
await page.waitForTimeout(200);
check('injection add', (await page.locator('#demo-wound').innerText()).includes('INJ-1'));

// 10. Print: preview updates + fake print dialog
await page.selectOption('#print-tpl', '覆診記錄表');
await page.waitForTimeout(200);
check('print preview swap', (await page.locator('#print-preview').innerText()).includes('博愛醫院'));
await page.selectOption('#print-res', '張金好');
await page.waitForTimeout(200);
check('print resident swap', (await page.locator('#print-preview').innerText()).includes('張金好'));
await page.click('#demo-print [data-act="print"]');
await page.waitForSelector('.fd-modal [data-act="ok"]');
await page.click('.fd-modal [data-act="ok"]');
await page.waitForTimeout(200);
check('print dialog', (await page.locator('.fd-toast').innerText()).includes('列印'));

// 11. Reports: tab switch + date/month swap
await page.click('[data-rtab="meals"]');
check('reports meals bars', await page.locator('.fd-bar-fill').count() >= 4);
await page.click('[data-rtab="daily"]');
await page.fill('#report-date', '2026-08-01');
await page.dispatchEvent('#report-date', 'change');
await page.waitForTimeout(200);
check('reports date swap', (await page.locator('#demo-reports').innerText()).includes('21 / 24'));
await page.click('[data-rtab="monthly"]');
await page.selectOption('#report-month', '2026-07');
await page.waitForTimeout(200);
check('reports month swap', (await page.locator('#demo-reports').innerText()).includes('701'));

// 12. Permissions: role switch + toggle hides nav item
await page.click('[data-role="護理員"]');
check('perm role nav hidden', await page.locator('.fd-mininav li.is-hidden').count() === 3);
await page.locator('input[data-feat="主控台"]').uncheck();
await page.waitForTimeout(200);
check('perm toggle hides nav', await page.locator('.fd-mininav li.is-hidden').count() === 4);

// 13. Mobile: scan → resident view → quick record; settings toggle
await page.click('#demo-mobile [data-mscan]');
await page.waitForTimeout(1700);
check('mobile scan to resident', (await page.locator('#demo-mobile').innerText()).includes('陳大文'));
await page.click('[data-mtab="換片"]');
await page.click('#demo-mobile [data-madd]');
await page.waitForTimeout(200);
check('mobile quick record', (await page.locator('#demo-mobile').innerText()).includes('換片 · 少量'));
await page.click('[data-ptab="settings"]');
await page.click('[data-mset="big"]');
check('mobile big font toggle', await page.locator('.fd-phone-screen[style]').count() === 1);

// Modal Esc close
await page.click('[data-task="t2"]');
await page.waitForSelector('.fd-modal-overlay');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('modal esc close', await page.locator('.fd-modal-overlay').count() === 0);

console.log(results.join('\n'));
console.log('\nJS errors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
await browser.close();
server.close();
const fails = results.filter(r => r.startsWith('FAIL'));
process.exit(errors.length || fails.length ? 1 : 0);
