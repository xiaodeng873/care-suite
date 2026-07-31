/**
 * 傷口評估記錄表 列印產生器
 * - 每 6 次評估一頁，動態多頁，最後一頁顯示人體圖
 * - human-body-diagram2.png + 紅點疊加傷口座標 (x%, y%)
 * - checkbox: <input type="checkbox" checked> (同約束物品表單)
 * - 相片: base64 inline, aspect-ratio 1/1 裁切
 */

import type { Wound, WoundAssessment, Patient } from '../lib/database';
import { computeNextAssessmentDue } from '../lib/database';
import { getFacilitySettings } from './facilitySettings';
import { formatDisplayDate } from '../utils/dateFormat';
import { getPrintBedNumber } from './bedTransferUtils';



const IFRAME_ID = 'wound-assessment-print-iframe';
const COLS_PER_PAGE = 6;

const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const chk = (v: boolean): string => v ? ' checked' : '';

const fmtDate = (d: string | null | undefined): string =>
  d ? formatDisplayDate(d) : '';

const colA = (arr: (WoundAssessment | null)[], i: number): WoundAssessment | null =>
  arr[i] ?? null;

/** 把 public 圖片抓成 base64 data URI（成功過的內嵌方法，iframe 列印必用） */
const fetchImageAsDataUri = async (path: string): Promise<string> => {
  try {
    const res = await fetch(path);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

// ── compact text-only helpers (只顯示已選擇項目) ─────────────────────────────

const textCell = (v: string | number | null | undefined): string =>
  `<td class="vc">${esc(String(v ?? ''))}</td>`;

const valCell = (v: string | null | undefined): string =>
  `<td class="vc">${esc(v ?? '')}</td>`;

const valMulti = (arr: string[] | null | undefined): string =>
  `<td class="vc">${esc((arr ?? []).filter(Boolean).join(' '))}</td>`;

const valBool = (v: boolean): string =>
  `<td class="vc">${v ? '\u2713' : ''}</td>`;

// ── cell generators ─────────────────────────────────────────────────────────

const stageCell = (a: WoundAssessment | null): string => valCell(a?.stage);

const exuAmtCell = (a: WoundAssessment | null): string =>
  valCell(!a ? '' : (a.exudate_present ? (a.exudate_amount ?? '') : '無'));

const exuColorCell = (a: WoundAssessment | null): string => valCell(a?.exudate_color);
const exuTypeCell  = (a: WoundAssessment | null): string => valCell(a?.exudate_type);
const odorCell     = (a: WoundAssessment | null): string => valCell(a?.odor);
const granCell     = (a: WoundAssessment | null): string => valCell(a?.granulation);
const necrosisCell = (a: WoundAssessment | null): string => valCell(a?.necrosis);

const infectionCell = (a: WoundAssessment | null): string => {
  const signs = a?.infection_signs ?? (a?.infection ? [a.infection] : []);
  return valMulti(signs.filter(Boolean));
};

const tempCell = (a: WoundAssessment | null): string =>
  valCell(!a ? '' : (a.temperature === '上升' ? '有' : '無'));

const skinHealthCell   = (a: WoundAssessment | null): string => valBool(a?.surrounding_skin_condition === 'healthy');
const skinColorCell    = (a: WoundAssessment | null): string => valCell(a?.surrounding_skin_color);
const skinTextureCell  = (a: WoundAssessment | null): string => valCell(a?.surrounding_skin_texture);

const cleanserCell = (a: WoundAssessment | null): string => {
  if (!a) return '<td class="vc"></td>';
  const v = a.cleanser === 'Normal Saline' ? 'NS' : (a.cleanser ?? '');
  const other = a.cleanser === '其他' ? (a.cleanser_other ?? '') : '';
  return `<td class="vc">${esc(other || v)}</td>`;
};

const dressingCell = (a: WoundAssessment | null): string =>
  textCell([...(a?.dressings ?? []), a?.dressing_other].filter(Boolean).join(', '));

const photoCell = (a: WoundAssessment | null): string => {
  const photos = (a?.wound_photos ?? []) as any[];
  if (!photos.length) return '<td><div class="db-photo-square"></div></td>';
  const first = photos[0];
  const src = typeof first === 'object' ? (first.base64 ?? '') : (first ?? '');
  return `<td><div class="db-photo-square" style="padding:0;overflow:hidden;">
    <img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">
  </div></td>`;
};

// ── next assessment date calculation ───────────────────────────────────────

const calcNextDue = (a: WoundAssessment, wound: Wound): string => {
  if (!a.assessment_date) return '';
  const unit = wound.assessment_frequency_unit ?? 'daily';
  const val  = Math.min(wound.assessment_frequency_value ?? 7, 7); // max 7 days
  const next = new Date(a.assessment_date);
  if (unit === 'weekly' && wound.assessment_specific_days_of_week?.length) {
    const targets = wound.assessment_specific_days_of_week.map(d => d === 7 ? 0 : d);
    for (let i = 1; i <= 7; i++) {
      const check = new Date(a.assessment_date);
      check.setDate(check.getDate() + i);
      if (targets.includes(check.getDay())) return check.toISOString().split('T')[0];
    }
  }
  next.setDate(next.getDate() + val);
  return fmtDate(next.toISOString().split('T')[0]);
};

// ── rows ────────────────────────────────────────────────────────────────────

const makeRows = (cols: (WoundAssessment | null)[], wound: Wound): string => `
  <tr>
    <th colspan="2" class="bold">評估日期</th>
    ${cols.map(a => textCell(fmtDate(a?.assessment_date))).join('')}
  </tr>
  <tr>
    <th colspan="2" class="bold">傷口編號<br>位置</th>
    ${cols.map((a, i) => i === 0
      ? `<td class="db-text-cell">${esc(wound.wound_code)}<br>${esc(wound.wound_name ?? '')}</td>`
      : '<td class="db-text-cell"></td>'
    ).join('')}
  </tr>
  <tr>
    <th rowspan="2" class="bold">面<br>積<br>及<br>程<br>度</th>
    <th class="bold">長x闊x深</th>
    ${cols.map(a => {
      if (!a) return '<td class="db-text-cell"></td>';
      const dims = [a.area_length, a.area_width, a.area_depth].filter(v => v != null);
      return `<td class="db-text-cell">${esc(dims.length ? dims.join('\u00d7') + ' cm' : '')}</td>`;
    }).join('')}
  </tr>
  <tr>
    <th class="bold">階段</th>
    ${cols.map(a => stageCell(a)).join('')}
  </tr>
  <tr>
    <th rowspan="3" class="bold">滲<br>出<br>物</th>
    <th class="bold">滲出量</th>
    ${cols.map(a => exuAmtCell(a)).join('')}
  </tr>
  <tr><th class="bold">顏色</th>${cols.map(a => exuColorCell(a)).join('')}</tr>
  <tr><th class="bold">種類</th>${cols.map(a => exuTypeCell(a)).join('')}</tr>
  <tr><th colspan="2" class="bold">氣味</th>${cols.map(a => odorCell(a)).join('')}</tr>
  <tr><th colspan="2" class="bold">肉芽</th>${cols.map(a => granCell(a)).join('')}</tr>
  <tr><th class="bold">壞<br>死</th><th class="bold">腐肉</th>${cols.map(a => necrosisCell(a)).join('')}</tr>
  <tr>
    <th rowspan="2" class="bold">感<br>染</th>
    <th class="bold">症狀</th>
    ${cols.map(a => infectionCell(a)).join('')}
  </tr>
  <tr><th class="bold">體溫上升</th>${cols.map(a => tempCell(a)).join('')}</tr>
  <tr>
    <th rowspan="3" class="bold">週<br>邊<br>皮<br>膚<br>狀<br>況</th>
    <th class="bold" >健康柔軟</th>
    ${cols.map(a => skinHealthCell(a)).join('')}
  </tr>
  <tr><th class="bold">顏色</th>${cols.map(a => skinColorCell(a)).join('')}</tr>
  <tr><th class="bold">質感</th>${cols.map(a => skinTextureCell(a)).join('')}</tr>
  <tr>
    <th colspan="2" class="bold">現時洗劑</th>
    ${cols.map(a => cleanserCell(a)).join('')}
  </tr>
  <tr>
    <th colspan="2" class="bold">敷料/藥物<br>(如有)</th>
    ${cols.map(a => dressingCell(a)).join('')}
  </tr>
  <tr>
    <th colspan="2" class="bold">備註</th>
    ${cols.map(a => textCell(a?.remarks)).join('')}
  </tr>
  <tr>
    <th colspan="2" class="bold">傷口相片</th>
    ${cols.map(a => photoCell(a)).join('')}
  </tr>
  <tr>
    <th colspan="2" class="bold">下次評估日期</th>
    ${cols.map(a => textCell(a ? calcNextDue(a, wound) : '')).join('')}
  </tr>
  <tr>
    <th colspan="2" class="bold">評估者簽署</th>
    ${cols.map(a => textCell(a?.assessor)).join('')}
  </tr>`;

// ── page builder ────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4; margin: 0.4in 0.25in; }
@media print { html,body{background:#fff;} .no-print{display:none!important;} }
body { font-family:"DFKai-SB","BiauKai","標楷體",serif; margin:0; padding:0; background:#fff; width:100%; }
.container { width:100%; box-sizing:border-box; display:flex; flex-direction:column; min-height:276mm; }
.header { display:flex; justify-content:center; align-items:flex-start; margin-bottom:6px; position:relative; }
.header-left { position:absolute; left:0; top:0; width:18%; display:flex; }
.station-box { display:none; }
.identity-box { border:1.5px solid black; flex-grow:1; height:52px; padding:3px 8px; display:flex; flex-direction:column; justify-content:space-around; font-size:14px; font-weight:bold; }
.id-row { display:flex; align-items:center; }
.id-line { flex:1; border-bottom:1px solid black; min-height:14px; margin-left:2px; text-align:center; }
.header-center { text-align:center; flex-grow:1; padding:0 8px; }
.header-center h1 { margin:0; font-size:26px; font-weight:bold; }
.header-center h2 { margin: 4px 0 0 0; font-size:22px; font-weight:bold; display:inline-block; border-bottom:1.5px solid black; padding-bottom:2px; }
table { width:100%; border-collapse:collapse; table-layout:fixed; }
/* 統一字體：左側表頭與評估值欄同大小（只 th 加粗） */
th, td { border:1px solid black; text-align:center; vertical-align:middle; padding:0 2px; font-size:14px; line-height:1.05; }
.col-m { width:8mm; }
.col-s { width:15mm; }
.col-e { width:25mm; }
.bold { font-weight:bold; }
/* 符合項目：只顯示已選擇的文字 */
.vc { font-size:14px; padding:0 2px; }
.db-text-cell { min-height:11px; font-size:14px; padding:0 2px; }
.db-text-underline { display:inline-block; border-bottom:1px solid black; min-width:30px; height:14px; vertical-align:bottom; }
/* 相片 */
.db-photo-square { width:90%; aspect-ratio:1/1; border:1px dashed #ccc; margin:1px auto; display:flex; align-items:center; justify-content:center; font-size:7px; color:#aaa; background:#fafafa; }
/* 人體圖 */
.body-diagram-wrap { position:relative; display:block; width:100%; margin-top:6px; overflow:hidden; }
.body-diagram-img { width:100%; max-width:100%; height:auto; display:block; }
.wound-marker { position:absolute; transform:translate(-50%,-50%); pointer-events:none; width:16px; height:16px; }
.wound-marker::before,.wound-marker::after { content:''; position:absolute; width:100%; height:3px; background:#000 !important; top:50%; left:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.wound-marker::before { transform:translateY(-50%) rotate(45deg); }
.wound-marker::after { transform:translateY(-50%) rotate(-45deg); }
.footer { margin-top:auto; display:flex; justify-content:flex-end; align-items:flex-end; position:relative; height:30px; }
.page-num { position:absolute; left:50%; transform:translateX(-50%); font-size:24px; font-weight:bold; bottom:0; }
.doc-code { font-size:11px; font-weight:bold; align-self:flex-end; }
`;

const buildPage = (
  wound: Wound,
  patient: Patient,
  slice: WoundAssessment[],
  pageNum: number,
  totalPages: number,
  stationCode: string,
  facilityName: string,
) => (diagramDataUri: string): string => {
  const name = `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`;
  const cols = Array.from({ length: COLS_PER_PAGE }, (_, i) => colA(slice, i));
  const loc  = wound.wound_location ?? { x: 0, y: 0 };
  const isLast = pageNum === totalPages;

  // 計算「每星期次數」：每天次數式 = 7 ÷ 間隔天數（每天 1 次 = 7/1 = 7 次/週）
  // weekly 單位則取指定星期幾的數量
  // 無明確頻率資料時：兩個選項都不預選，第二個選項以底線留空（對應 doc_html 範本設計）
  const freqUnit = wound.assessment_frequency_unit ?? 'daily';
  const hasFreq = freqUnit === 'weekly'
    ? (wound.assessment_specific_days_of_week?.length ?? 0) > 0
    : wound.assessment_frequency_value != null;
  const timesPerWeek = !hasFreq ? null
    : freqUnit === 'weekly'
      ? (wound.assessment_specific_days_of_week?.length ?? 1)
      : Math.round(7 / (wound.assessment_frequency_value ?? 7));
  const timesPerWeekText = timesPerWeek != null && timesPerWeek > 1
    ? String(timesPerWeek)
    : '<span class="db-text-underline" style="min-width:25px;"></span>';

  return `<div class="container"${pageNum > 1 ? ' style="page-break-before:always;"' : ''}>
  <div class="header">
    <div class="header-left">
      <div class="station-box" style="text-align:center;">${esc(stationCode)}站</div>
      <div class="identity-box">
        <div class="id-row"><span class="id-label">姓名：</span><span class="id-line">${esc(name)}</span></div>
        <div class="id-row"><span class="id-label">床號：</span><span class="id-line">${esc(getPrintBedNumber(patient))}</span></div>
      </div>
    </div>
    <div class="header-center">
      <h1>${esc(facilityName)}</h1>
      <h2>傷口評估記錄表</h2>
      <div class="bold" style="font-size:14px;margin-top:2px;">
        <span style="margin-right:6px;"><input type="checkbox"${timesPerWeek === 1 ? ' checked' : ''}>每星期 1 次</span> / 
        <span><input type="checkbox"${timesPerWeek != null && timesPerWeek > 1 ? ' checked' : ''}>每星期 ${timesPerWeekText} 次</span>
      </div>
    </div>
  </div>
  <table>
    <colgroup>
      <col class="col-m"><col class="col-s">
      <col class="col-e"><col class="col-e"><col class="col-e">
      <col class="col-e"><col class="col-e"><col class="col-e">
    </colgroup>
    ${makeRows(cols, wound)}
  </table>
  ${isLast && diagramDataUri ? `
  <div class="body-diagram-wrap">
    <img class="body-diagram-img" src="${diagramDataUri}" alt="人體方位圖">
    <div class="wound-marker" style="left:${loc.x}%;top:${loc.y}%;"></div>
  </div>` : ''}
  <div class="footer">
    <div class="page-num">10</div>
    <div class="doc-code">B19 FK (11.2020)</div>
  </div>
</div>`;
};

// ── public API ───────────────────────────────────────────────────────────────

export const generateWoundAssessmentHtml = async (
  wound: Wound,
  assessments: WoundAssessment[],
  patient: Patient,
  stationCode = '',
): Promise<string> => {
  const settings = await getFacilitySettings();
  const diagramDataUri = await fetchImageAsDataUri('/human-body-diagram2.png');
  const sorted = [...assessments].sort(
    (a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / COLS_PER_PAGE));
  const pages = Array.from({ length: totalPages }, (_, i) =>
    buildPage(wound, patient, sorted.slice(i * COLS_PER_PAGE, (i + 1) * COLS_PER_PAGE), i + 1, totalPages, stationCode, settings.facilityNameZh)(diagramDataUri)
  );
  return `<!DOCTYPE html>
<html lang="zh-HK"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1050">
<title>傷口評估記錄表 - ${esc(wound.wound_name ?? wound.wound_code)}</title>
<style>${CSS}</style>
</head><body>${pages.join('\n')}</body></html>`;
};

export const printWoundAssessment = async (
  wound: Wound,
  assessments: WoundAssessment[],
  patient: Patient,
  stationCode = '',
): Promise<void> => {
  const html = await generateWoundAssessmentHtml(wound, assessments, patient, stationCode);
  const old = document.getElementById(IFRAME_ID);
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();

  // 等待 iframe 內所有圖片載入完成才列印（防人體圖/相片未渲染就列印）
  const win = iframe.contentWindow;
  if (!win) return;
  const doPrint = () => { win.focus(); win.print(); };
  const imgs = Array.from(doc.images);
  if (imgs.length === 0) {
    setTimeout(doPrint, 200);
    return;
  }
  let loaded = 0;
  let done = false;
  const check = () => {
    loaded++;
    if (!done && loaded >= imgs.length) { done = true; setTimeout(doPrint, 100); }
  };
  imgs.forEach(img => {
    if (img.complete) { check(); }
    else { img.addEventListener('load', check); img.addEventListener('error', check); }
  });
  // 保底：最多等 3 秒
  setTimeout(() => { if (!done) { done = true; doPrint(); } }, 3000);
};

/** 另存新檔：下載傷口評估記錄表 HTML */
export const saveWoundAssessmentHtml = async (
  wound: Wound,
  assessments: WoundAssessment[],
  patient: Patient,
): Promise<void> => {
  const html = await generateWoundAssessmentHtml(wound, assessments, patient);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const patientName = `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`;
  a.href = url;
  a.download = `傷口評估記錄表_${patientName}_${wound.wound_code}_${new Date().toISOString().split('T')[0]}.html`;
  a.click();
  URL.revokeObjectURL(url);
};
