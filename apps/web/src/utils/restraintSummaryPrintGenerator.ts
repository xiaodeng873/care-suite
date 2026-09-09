/**
 * 約束物品總表 HTML 列印產生器
 * A4 橫向，每位院友一行，列出各約束物品種類、使用情況及使用時段
 * 透過隱藏 iframe 列印，不開新網頁
 * 列印時以行內腳本量度分頁：序號跨頁連續、每頁重複表頭、頁尾顯示「第N/N頁」
 */

import type { Patient, PatientRestraintAssessment } from '../lib/database';
import { getFacilitySettings } from './facilitySettings';
import { getPrintBedNumber } from './bedTransferUtils';
import { formatDisplayDate } from './dateFormat';
import { compareBedNumbers } from './searchUtils';

const IFRAME_ID = 'restraint-summary-print-iframe';

// ── 輔助 ─────────────────────────────────────────────────────────────────────

const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 將時段代碼轉換為小時數字字串
 * "7A"→"7", "12N"→"12", "1P"→"13", "12M"→"0", "3A"→"3"
 */
const timeToHour = (t: string | undefined | null): string => {
  if (!t) return '';
  if (t === '12N') return '12';
  if (t === '12M') return '0';
  const match = t.match(/^(\d+)([APN])$/i);
  if (!match) return t;
  const num = parseInt(match[1], 10);
  const period = match[2].toUpperCase();
  if (period === 'A') return String(num);
  if (period === 'P') return String(num === 12 ? 12 : num + 12);
  return t;
};

/** 時段代碼 → "HH:MM"（24 小時制）；無法解析時原樣回傳 */
const timeCodeToHM = (t: string | undefined | null): string => {
  const hour = timeToHour(t);
  if (hour === '' || hour === (t ?? '')) return hour;
  const n = parseInt(hour, 10);
  if (Number.isNaN(n)) return '';
  return `${String(n).padStart(2, '0')}:00`;
};

const dashIfEmpty = (s: string): string => s || '—';

/** 建議約束物品中已勾選的項目 */
const checkedEntries = (suggestedRestraints: any): Array<{ key: string; config: any }> =>
  Object.entries(suggestedRestraints ?? {})
    .filter(([, config]: [string, any]) => !!config?.checked)
    .map(([key, config]) => ({ key, config }));

/** 種類顯示名稱：「其他：」改用 otherRestraintType 文字 */
const typeDisplayName = (key: string, config: any): string => {
  if (key === '其他：') {
    const other = (config?.otherRestraintType ?? '').toString().trim();
    if (other) return `${key}${other}`;
  }
  return key;
};

/** 使用時段：類型：全日 / 日間 HH:MM-HH:MM、晚上 HH:MM-HH:MM、其他文字 */
const timeSlotLine = (key: string, config: any): string => {
  const name = typeDisplayName(key, config);
  if (config?.allDay) return `${esc(name)}：全日`;

  const parts: string[] = [];
  if (config?.dayTime) {
    let part = '日間';
    const start = timeCodeToHM(config?.dayStartTime);
    const end = timeCodeToHM(config?.dayEndTime);
    if (start || end) part += ` ${start || '??:??'}-${end || '??:??'}`;
    parts.push(part);
  }
  if (config?.nightTime) {
    let part = '晚上';
    const start = timeCodeToHM(config?.nightStartTime);
    const end = timeCodeToHM(config?.nightEndTime);
    if (start || end) part += ` ${start || '??:??'}-${end || '??:??'}`;
    parts.push(part);
  }
  const otherTime = (config?.otherTime ?? '').toString().trim();
  if (otherTime) parts.push(esc(otherTime));

  return `${esc(name)}：${parts.join('、') || '—'}`;
};

// ── 分頁腳本（字串形式注入列印 HTML）─────────────────────────────────────────

/**
 * Chrome 列印不支援 @page margin box，純 CSS 做唔到「第N/N頁」，
 * 所以於 parse 時以行內腳本量度分頁：
 * 1. 用 100mm 探針求 pxPerMm；
 * 2. 量標題、表頭、頁尾原型及每列高度；
 * 3. 以 (210mm − 上下邊距) 減去固定元素高度作為每頁列高預算，貪婪裝列；
 * 4. 每頁輸出 .page（標題 + 完整 thead + 該頁 tbody + 頁尾），最後一頁不強制分頁。
 */
const PAGINATE_SCRIPT = `(function () {
  var probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:100mm;';
  document.body.appendChild(probe);
  var pxPerMm = probe.offsetHeight / 100;
  probe.remove();

  var measure = document.getElementById('measure');
  var headerProto = document.getElementById('measure-header');
  var footerProto = document.getElementById('measure-footer');
  var table = document.getElementById('measure-table');
  var thead = table.tHead;
  var rowEls = Array.prototype.slice.call(table.tBodies[0].rows);

  // A4 橫向高 210mm，@page 上下各 8mm，再留 4px 緩衝
  var usablePx = (210 - 16) * pxPerMm;
  var budget = usablePx - headerProto.offsetHeight - footerProto.offsetHeight - thead.offsetHeight - 4;

  var pages = [];
  var current = [];
  var used = 0;
  rowEls.forEach(function (r) {
    var h = r.offsetHeight;
    if (current.length && used + h > budget) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(r.outerHTML);
    used += h;
  });
  if (current.length) pages.push(current);
  if (!pages.length) pages.push([]);

  var total = pages.length;
  var headerHtml = headerProto.outerHTML.replace('id="measure-header"', '');
  var footerHtml = footerProto.outerHTML.replace('id="measure-footer"', '');
  var theadHtml = thead.outerHTML;

  var host = document.getElementById('pages');
  pages.forEach(function (rowHtmls, i) {
    var page = document.createElement('div');
    page.className = 'page' + (i === total - 1 ? ' last' : '');
    var footer = footerHtml.replace('第N/N頁', '第' + (i + 1) + '/' + total + '頁');
    page.innerHTML = headerHtml
      + '<table class="main-table">' + theadHtml + '<tbody>' + rowHtmls.join('') + '</tbody></table>'
      + footer;
    host.appendChild(page);
  });

  measure.remove();
})();`;

// ── 主 HTML 產生函數 ──────────────────────────────────────────────────────────

export const generateRestraintSummaryHtml = (
  items: Array<{ assessment: PatientRestraintAssessment; patient: Patient }>,
  facilityName: string
): string => {
  const today = formatDisplayDate(new Date());

  // 表格一律按床號自然排序（空床號排最後），與全院其他列表一致
  const sortedItems = [...items].sort((a, b) =>
    compareBedNumbers(getPrintBedNumber(a.patient), getPrintBedNumber(b.patient))
  );

  const rows = sortedItems.map(({ assessment, patient }, index) => {
    const patientName = `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}` || patient.中文姓名 || '';
    const entries = checkedEntries(assessment.suggested_restraints);

    const typesCell = entries
      .map(({ key, config }) => esc(typeDisplayName(key, config)))
      .join('、');

    const conditionsCell = entries
      .map(({ key, config }) => {
        const raw = config?.usageConditions;
        const cond = (Array.isArray(raw) ? raw.join('、') : (raw ?? '').toString()).trim();
        return `${esc(typeDisplayName(key, config))}：${cond ? esc(cond) : '—'}`;
      })
      .join('<br>');

    const timeCell = entries
      .map(({ key, config }) => timeSlotLine(key, config))
      .join('<br>');

    return `<tr>
  <td class="col-seq">${index + 1}</td>
  <td class="col-bed">${esc(getPrintBedNumber(patient))}</td>
  <td class="col-name">${esc(patientName)}</td>
  <td class="col-date">${esc(formatDisplayDate(assessment.doctor_signature_date))}</td>
  <td class="col-date">${esc(formatDisplayDate(assessment.next_due_date))}</td>
  <td class="col-types">${dashIfEmpty(typesCell)}</td>
  <td class="col-cond">${dashIfEmpty(conditionsCell)}</td>
  <td class="col-time">${dashIfEmpty(timeCell)}</td>
</tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>${esc(facilityName)} 約束物品總表</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
body {
  font-family: "DFKai-SB","BiauKai","標楷體",serif;
  margin: 0; padding: 0; background: #fff; color: #000;
  font-size: 12px; line-height: 1.4;
}
.header { text-align: center; margin-bottom: 8px; }
.header h1 { margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px; }
.header .print-date { font-size: 12px; margin-top: 2px; }
.main-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.2px solid black; }
.main-table th, .main-table td { border: 1px solid black; vertical-align: top; padding: 4px 6px; }
.main-table th { text-align: center; vertical-align: middle; font-weight: bold; font-size: 13px; background: #f3f4f6; }
.main-table td { font-size: 12px; }
.main-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
.footer { text-align: right; font-size: 12px; padding-top: 4px; }
.page { page-break-after: always; }
.page.last { page-break-after: auto; }
#measure { position: absolute; left: -9999px; top: 0; width: 281mm; }
.col-seq   { width: 40px; text-align: center; }
.col-bed   { width: 55px; }
.col-name  { width: 70px; }
.col-date  { width: 80px; }
.col-types { width: 150px; }
.col-cond  { width: auto; }
.col-time  { width: 200px; }
</style>
</head>
<body>
<div id="measure">
  <div class="header" id="measure-header">
    <h1>${esc(facilityName)} 約束物品總表</h1>
    <div class="print-date">列印日期：${esc(today)}</div>
  </div>
  <table class="main-table" id="measure-table">
    <thead>
      <tr>
        <th class="col-seq">序號</th>
        <th class="col-bed">床號</th>
        <th class="col-name">姓名</th>
        <th class="col-date">醫生簽署日期</th>
        <th class="col-date">下次到期日</th>
        <th class="col-types">約束物品種類</th>
        <th class="col-cond">各種類使用情況</th>
        <th class="col-time">使用時段</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="footer" id="measure-footer">第N/N頁</div>
</div>
<div id="pages"></div>
<script>${PAGINATE_SCRIPT}</script>
</body>
</html>`;
};

// ── 列印入口 ──────────────────────────────────────────────────────────────────

/**
 * 列印約束物品總表（已按需要排序好的院友清單，每位院友取其最新評估）
 */
export const printRestraintSummary = async (
  items: Array<{ assessment: PatientRestraintAssessment; patient: Patient }>
): Promise<void> => {
  if (items.length === 0) return;

  const settings = await getFacilitySettings();
  const html = generateRestraintSummaryHtml(items, settings.facilityNameZh);

  const old = document.getElementById(IFRAME_ID);
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => { iframe.contentWindow?.print(); }, 400);
};
