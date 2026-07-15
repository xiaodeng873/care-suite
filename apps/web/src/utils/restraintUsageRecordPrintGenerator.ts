/**
 * 使用約束物品紀錄 列印產生器
 * 格式完全複刻 doc_html/使用約束物品紀錄.html
 * 每位院友取其所有歷史評估的 usage_record，按開始日期升序排列，每筆 = 表格一行
 * 最少顯示 7 行（空行補底），透過隱藏 iframe 列印，不開新網頁
 */

import type { Patient, PatientRestraintAssessment } from '../lib/database';

const FACILITY_NAME = '善頤(福群)護老院';
const MIN_ROWS = 7;
const IFRAME_ID = 'restraint-usage-record-print-iframe';

// ── 輔助 ─────────────────────────────────────────────────────────────────────

const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const chk = (v: boolean | string | undefined): string => v ? ' checked' : '';

const fmtDate = (d: string | undefined | null): string =>
  d ? d.replace(/-/g, '/') : '';

// ── 行產生器 ──────────────────────────────────────────────────────────────────

const reasonLabels = ['自身安全', '維持治療', '防止跌倒', '免傷害他人', '其他:'];
const typeLabels   = ['約束衣', '約束腰帶', '手腕帶', '約束手套', '防滑褲帶', '枱板', '其他:'];
const obsLabels    = ['血液循環', '呼吸狀況', '精神狀況', '皮膚狀況', '姿勢舒適', '其他:'];

const renderOptGroup = (labels: string[], map: Record<string, boolean | string> | undefined): string =>
  labels.map(label => {
    const isOther = label.endsWith(':');
    const key = isOther ? '其他' : label;
    const checked = !!(map?.[key]);
    const textVal = isOther ? esc(map?.['其他_text'] as string || '') : '';
    const textField = isOther
      ? `<input type="text" class="db-line-input" style="width:55px; min-height:10px;" value="${textVal}">`
      : '';
    return `<div class="opt-item"><input type="checkbox" class="db-checkbox"${chk(checked)}>${esc(label)}${textField}</div>`;
  }).join('');

const renderDataRow = (ur: any): string => `
<tr class="record-row">
  <td class="col-date"><input type="text" class="db-text-cell" value="${esc(fmtDate(ur.start_date))}"></td>
  <td class="col-date"><input type="text" class="db-text-cell" value="${esc(fmtDate(ur.end_date))}"></td>
  <td class="col-reason">${renderOptGroup(reasonLabels, ur.reasons)}</td>
  <td class="col-type">${renderOptGroup(typeLabels, ur.types)}</td>
  <td class="col-doctor"><input type="text" class="db-text-cell" value="${esc(ur.doctor)}"></td>
  <td class="col-obs">${renderOptGroup(obsLabels, ur.observations)}</td>
</tr>`.trim();

const renderEmptyRow = (): string => `
<tr class="record-row">
  <td class="col-date"><input type="text" class="db-text-cell" value=""></td>
  <td class="col-date"><input type="text" class="db-text-cell" value=""></td>
  <td class="col-reason">${renderOptGroup(reasonLabels, undefined)}</td>
  <td class="col-type">${renderOptGroup(typeLabels, undefined)}</td>
  <td class="col-doctor"><input type="text" class="db-text-cell" value=""></td>
  <td class="col-obs">${renderOptGroup(obsLabels, undefined)}</td>
</tr>`.trim();

// ── 主 HTML 產生函數 ──────────────────────────────────────────────────────────

export const generateRestraintUsageRecordHtml = (
  assessments: PatientRestraintAssessment[],
  patient: Patient
): string => {
  const patientName = `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}` || patient.中文姓名;

  // 取所有有 usage_record 的評估，按 start_date 升序
  const usageRows = assessments
    .filter(a => a.usage_record)
    .map(a => a.usage_record)
    .sort((a, b) => {
      const da = a.start_date || '';
      const db_ = b.start_date || '';
      return da < db_ ? -1 : da > db_ ? 1 : 0;
    });

  const totalRows = Math.max(usageRows.length, MIN_ROWS);
  const rows = [
    ...usageRows.map(renderDataRow),
    ...Array(totalRows - usageRows.length).fill(null).map(renderEmptyRow),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1050">
<title>使用約束物品紀錄</title>
<style>
@page { size: A4; margin: 5mm 0.25in 15mm 0.25in; }
@media print { .no-print { display: none !important; } }

body {
  font-family: "DFKai-SB","BiauKai","標楷體",serif;
  margin: 0; padding: 0; background: #fff; color: #000;
  font-size: 11px; line-height: 1.1;
}
.print-wrapper { width: 100%; border-collapse: collapse; }
.page-header { display: table-header-group; }
.page-footer { display: table-footer-group; }
.container { width: 100%; box-sizing: border-box; }
.title-section { text-align: center; margin-bottom: 5px; }
.title-section h1 { margin: 0; font-size: 30px; font-weight: bold; }
.title-section h2 { margin: 0; font-size: 24px; font-weight: bold; }
.user-info { display: flex; justify-content: space-between; margin-bottom: 3px; font-weight: bold; font-size: 14px; }
.db-line-input {
  display: inline-block; border: none; border-bottom: 1px solid black;
  background: transparent; font-family: inherit; padding: 0 2px;
  vertical-align: bottom; min-height: 14px;
}
.instructions { font-size: 12px; margin-bottom: 4px; border-top: 0.5px solid #ccc; padding-top: 2px; text-align: left; }
.instructions ul { margin: 0; padding-left: 15px; list-style-type: disc; }
.main-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.2px solid black; }
.main-table th, .main-table td { border: 1px solid black; vertical-align: top; padding: 1px 2px; }
.main-table th { height: 20px; text-align: center; vertical-align: middle; font-weight: bold; font-size: 14px; }
.col-date   { width: 62px; }
.col-reason { width: 125px; }
.col-type   { width: 135px; }
.col-doctor { width: 80px; }
.col-obs    { width: auto; }
.opt-item { display: flex; align-items: center; margin: 0; white-space: nowrap; font-size: 13px; height: 13px; line-height: 1; }
.db-checkbox { width: 10px; height: 10px; margin-right: 2px; cursor: pointer; }
.db-text-cell { width: 100%; height: 100%; border: none; background: transparent; font-family: inherit; font-size: 10.5px; outline: none; }
.record-row { height: 30mm; }
.record-row td { page-break-inside: avoid; break-inside: avoid; }
.footer-content { margin-top: 5px; display: flex; justify-content: flex-end; position: relative; height: 30px; font-weight: bold; width: 100%; }
.page-num { position: absolute; left: 50%; transform: translateX(-50%); font-size: 18px; bottom: 5px; }
.doc-code { font-size: 9px; align-self: flex-end; padding-bottom: 5px; }
</style>
</head>
<body>
<table class="print-wrapper">
  <thead class="page-header">
    <tr><td>
      <div class="container">
        <div class="title-section">
          <h1>${esc(FACILITY_NAME)}</h1>
          <h2>使用約束物品紀錄</h2>
        </div>
        <br>
        <br>
        <div class="user-info">
          <div>姓名：<span class="db-line-input" style="width:130px;">${esc(patientName)}</span></div>
          <div>床號：<span class="db-line-input" style="width:80px;">${esc(patient.床號)}</span></div>
          <div>身份證號碼：<span class="db-line-input" style="width:150px;">${esc(patient.身份證號碼)}</span></div>
        </div>
        <div class="instructions">
          <ul>
            <li>原因：自身安全、維持治療、防止跌倒、免傷害他人等等</li>
            <li>種類：約束衣、手/足約束帶、約束手套、防滑褲帶、枱板、床欄等等</li>
            <li>觀察事項：血液循環、呼吸狀況、精神狀況、皮膚狀況、姿勢舒適等等</li>
          </ul>
        </div>
        <table class="main-table" style="border-bottom:none;">
          <thead>
            <tr>
              <th class="col-date">開始日期</th>
              <th class="col-date">結束日期</th>
              <th class="col-reason">原因</th>
              <th class="col-type">種類</th>
              <th class="col-doctor">處方醫生</th>
              <th class="col-obs">需要觀察事項</th>
            </tr>
          </thead>
        </table>
      </div>
    </td></tr>
  </thead>
  <tbody>
    <tr><td>
      <table class="main-table" style="border-top:none;">
        ${rows}
      </table>
    </td></tr>
  </tbody>
  <tfoot class="page-footer">
    <tr><td>
      <div class="footer-content">
        <div class="page-num">11</div>
        <div class="doc-code">B10D FK (2.2025)</div>
      </div>
    </td></tr>
  </tfoot>
</table>
</body>
</html>`;
};

// ── 列印入口 ──────────────────────────────────────────────────────────────────

/**
 * 列印一位或多位院友的約束物品使用紀錄
 * items: 每個元素對應一位院友及其所有歷史評估
 */
export const printRestraintUsageRecords = (
  items: Array<{ assessments: PatientRestraintAssessment[]; patient: Patient }>
): void => {
  if (items.length === 0) return;

  const htmlPages = items.map(({ assessments, patient }) =>
    generateRestraintUsageRecordHtml(assessments, patient)
  );

  // 合併多位院友：第一份 HTML 完整，後續只取 body 內容
  let combined = htmlPages[0];
  for (let i = 1; i < htmlPages.length; i++) {
    const bodyMatch = htmlPages[i].match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      combined = combined.replace('</body>', bodyMatch[1] + '\n</body>');
    }
  }

  const old = document.getElementById(IFRAME_ID);
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(combined);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => { iframe.contentWindow?.print(); }, 400);
};
