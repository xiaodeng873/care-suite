/**
 * 換片及大便記錄 列印表格 (iframe HTML 版)
 * 嚴格複刻範本「換片及大便記錄 (B83 FK 06.2026)」：A4 橫向、每頁 4 天、共 4 頁 = 16 天空白表
 *
 * 映射關係（一對一）：
 *  - 院友姓名：中文姓氏 + 中文名字（fallback 中文姓名）
 *  - 床號：患者床號
 *  - 月份/年份：使用者輸入年月（如 2026年06月）
 *  - 6 個時段：7AM-11AM / 11AM-3PM / 3PM-7PM / 7PM-11PM / 11PM-3AM / 3AM-7AM
 *  - 每時段 5 欄：小便 | 大便(色) | 大便(質) | 大便(量) | 簽名
 *  - 小便：☐多/☐中/☐少 ；大便色：☐正常/☐有血/☐有潺/☐黑便 ；質：☐硬/☐軟/☐稀 ；量：☐多/☐中/☐少
 *  - 尿片 / 片芯 列
 */

import type { Patient } from '../lib/database';
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';

const TITLE = '換片及大便記錄 (B83 FK 06.2026)';
const DATES_PER_PAGE = 4;
const TOTAL_PAGES = 4;

const TIME_SLOTS = [
  '7AM-11AM',
  '11AM-3PM',
  '3PM-7PM',
  '7PM-11PM',
  '11PM-3AM',
  '3AM-7AM',
];

// 單一天空白表格區塊（嚴格複刻範本線條）
// 欄位：日期欄(1) + 6 時段 × [小便, 色, 質, 量, 簽名]
const dayBlock = (): string => {
  const slot = TIME_SLOTS.length;
  const cell = (t: string) => `<td class="cb">${t ? '☐ ' + t : ''}</td>`;
  // 1. 時間行
  const timeRow = `<tr><th class="hc">時間</th>${TIME_SLOTS.map(s => `<th class="hc" colspan="5">${s}</th>`).join('')}</tr>`;
  // 2. 日期行：日期(rowspan2) | 小便(rowspan2) | 大便(colspan3) | 簽名(rowspan2)
  const dateRow = `<tr><th class="hc" rowspan="2">日期</th>${Array(slot).fill('').map(() => `<th class="hc" rowspan="2">小便</th><th class="hc" colspan="3">大便</th><th class="hc" rowspan="2">簽名</th>`).join('')}</tr>`;
  // 3. (色、質、量) 子行：僅大便欄
  const subRow = `<tr>${Array(slot).fill('').map(() => `<th class="hc sm" colspan="3">(色、質、量)</th>`).join('')}</tr>`;
  // 4. 資料行 1：日期欄(rowspan5 到底) | 小便|色|質|量 | 簽名欄(rowspan5 到底)
  const r1 = `<tr><td class="dc" rowspan="5"></td>${Array(slot).fill('').map(() => cell('多') + cell('正常') + cell('硬') + cell('多') + `<td class="sig" rowspan="5"></td>`).join('')}</tr>`;
  const r2 = `<tr>${Array(slot).fill('').map(() => cell('中') + cell('有血') + cell('軟') + cell('中')).join('')}</tr>`;
  const r3 = `<tr>${Array(slot).fill('').map(() => cell('少') + cell('有潺') + cell('稀') + cell('少')).join('')}</tr>`;
  const r4 = `<tr>${Array(slot).fill('').map(() => cell('') + cell('黑便') + cell('') + cell('')).join('')}</tr>`;
  // 5. 尿片/片芯行：日期欄與簽名欄已被 rowspan5 蓋住，不再出格 | 尿片|空|片芯(質)|空
  const r5 = `<tr>${Array(slot).fill('').map(() => `<td class="cb">尿片</td><td class="cb"></td><td class="cb">片芯</td><td class="cb"></td>`).join('')}</tr>`;
  return timeRow + dateRow + subRow + r1 + r2 + r3 + r4 + r5;
};


const pageBlock = (name: string, bed: string, yearMonth: string, facilityName: string): string => {
  const days = Array(DATES_PER_PAGE).fill('').map(() => dayBlock()).join('<tr class="sep"><td colspan="31"></td></tr>') + '<tr class="sep"><td colspan="31"></td></tr>';
  return `
  <div class="page"><div class="inner">
    <div class="inst">${facilityName}</div>
    <div class="title">${TITLE}</div>
    <div class="info">
      <div><span>院友姓名：</span><span class="ul">${name}</span></div>
      <div><span>床號：</span><span class="ul">${bed}</span></div>
      <div><span>月份/年份：</span><span class="ul">${yearMonth}</span></div>
    </div>
    <table class="rt"><tbody>${days}</tbody></table>
  </div></div>`;
};

export const generateDiaperRecordPrintFormHtml = (patients: Patient[], yearMonth: string, facilityName: string): string => {
  const pages = patients.map(p => {
    const name = p.中文姓名 || `${p.中文姓氏 || ''}${p.中文名字 || ''}`;
    const bed = p.床號 || '';
    return Array(TOTAL_PAGES).fill('').map(() => pageBlock(name, bed, yearMonth, facilityName)).join('');
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="utf-8"/><title>換片及大便記錄</title>
<style>
@page { size: A4 landscape; margin: 6mm; }
* { box-sizing: border-box; }
body { font-family:"Microsoft JhengHei","微軟正黑體","PingFang TC",sans-serif; margin:0; padding:0; background:#f4f4f4; font-size:10px; color:#000; }
.no-print { text-align:center; margin:10px; }
.no-print button { padding:8px 20px; font-size:12px; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer; }
.page { width:100%; height:198mm; margin:0 auto; background:#fff; page-break-after:always; display:flex; flex-direction:column; }
.inner { width:100%; flex:1; display:flex; flex-direction:column; min-height:0; }
.inst { text-align:center; font-size:16px; font-weight:bold; }
.title { text-align:center; font-size:14px; font-weight:bold; margin:2px 0 4px; }
.info { display:flex; justify-content:center; gap:40px; margin-bottom:3px; font-size:12px; }
.ul { border-bottom:1px solid #000; padding:0 30px; font-weight:bold; }
.rt { width:100%; border-collapse:collapse; table-layout:fixed; }
.rt th,.rt td { border:1px solid #000; text-align:center; vertical-align:middle; padding:2px; overflow:hidden; }
.hc { background:#e9ecef; font-weight:bold; height:5mm; }
.sm { font-size:8px; height:3.5mm; }
.cb { height:5.5mm; white-space:nowrap; font-size:9px; }
.dc { width:34px; font-weight:bold; }
.sig { width:40px; }
.sep td { border:none; height:1.5mm; background:#d9d9d9; }
@media print { body{background:#fff;} .no-print{display:none!important;} .page{box-shadow:none;margin:0;} }
</style></head>
<body>
<div class="no-print"><button onclick="window.print()">列印</button></div>
${pages}
</body></html>`;
};

export const printDiaperRecordForm = async (patients: Patient[], yearMonth: string): Promise<void> => {
  const settings = await getFacilitySettings();
  const html = generateDiaperRecordPrintFormHtml(patients, yearMonth, settings.facilityNameZh);
  const old = document.getElementById('diaper-printform-iframe');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'diaper-printform-iframe';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  }
};
