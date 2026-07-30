/**
 * 出入量記錄表 HTML 列印產生器
 * A4 直向，24 小時（臨床日 07:00→06:00），1頁/天
 */
import { formatDisplayDate } from './dateFormat';

export interface IntakeOutputRowInput {
  time_slot: string;            // '07:00'
  meal?: string;                // '早 1/2'
  beverage_type?: string;       // '水'
  beverage_ml?: number;
  tube_type?: string;           // 'Isocal'
  tube_ml?: number;
  other?: string;               // '餅乾 2塊'
  gastric_color_ph?: string;    // '黃 pH6.5'
  gastric_ml?: number;
  urine_color?: string;         // '黃'
  urine_ml?: number;
  recorder?: string;
  notes?: string;
}

export interface IntakeOutputHtmlInput {
  facilityName?: string;
  patientName: string;
  bedNumber: string;
  genderAge: string;
  recordDate: string;           // '2026/07/04'
  targetIntakeMl?: number;
  mealCombination?: string;     // '正飯+碎餸'
  specialDiets?: string[];      // ['糖尿餐','低鹽餐']
  rows?: IntakeOutputRowInput[];
}

import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';
const CLINICAL_SLOTS = [
  '07:00','08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00',
  '19:00','20:00','21:00','22:00','23:00',
  '00:00','01:00','02:00','03:00','04:00','05:00','06:00',
];

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export function generateIntakeOutputHtml(input: IntakeOutputHtmlInput): string {
  const {
    facilityName = DEFAULT_FACILITY_SETTINGS.facilityNameZh,
    patientName,
    bedNumber,
    genderAge,
    recordDate,
    targetIntakeMl,
    mealCombination,
    specialDiets = [],
    rows = [],
  } = input;

  // 建立時段索引
  const rowMap = new Map<string, IntakeOutputRowInput>();
  for (const r of rows) rowMap.set(r.time_slot, r);

  // 計算總量
  let totalIntakeMl = 0;
  let totalOutputMl = 0;
  for (const r of rows) {
    totalIntakeMl += (r.beverage_ml ?? 0) + (r.tube_ml ?? 0);
    totalOutputMl += (r.gastric_ml ?? 0) + (r.urine_ml ?? 0);
  }
  const balance = totalIntakeMl - totalOutputMl;


  // 渲染資料行
  const dataRows = CLINICAL_SLOTS.map(slot => {
    const r = rowMap.get(slot) ?? {};
    const bevMl  = r.beverage_ml  != null ? String(r.beverage_ml)  : '';
    const tubeMl = r.tube_ml      != null ? String(r.tube_ml)      : '';
    const gMl    = r.gastric_ml   != null ? String(r.gastric_ml)   : '';
    const uMl    = r.urine_ml     != null ? String(r.urine_ml)     : '';
    return `<tr>
      <td class="tc">${slot}</td>
      <td class="tl">${esc(r.meal)}</td>
      <td class="tl">${esc(r.beverage_type)}</td>
      <td class="tr">${bevMl}</td>
      <td class="tl">${esc(r.tube_type)}</td>
      <td class="tr">${tubeMl}</td>
      <td class="tl">${esc(r.other)}</td>
      <td class="tl">${esc(r.gastric_color_ph)}</td>
      <td class="tr">${gMl}</td>
      <td class="tl">${esc(r.urine_color)}</td>
      <td class="tr">${uMl}</td>
      <td class="tl">${esc(r.recorder)}${r.notes ? ' '+esc(r.notes) : ''}</td>
    </tr>`;
  }).join('');

  const balanceSign = balance >= 0 ? '+' : '';

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=820, initial-scale=1">
<title>${facilityName} 出入量記錄表</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4 portrait; margin: 5mm; }
body {
  font-family: 'Microsoft JhengHei', '微軟正黑體', 'PingFang TC', sans-serif;
  font-size: 7.5pt;
  color: #111;
  background: #fff;
}
@media screen {
  html { background: #c8ccd0; min-height: 100%; }
  body { background: #c8ccd0; }
  .pw  { padding: 8mm; }
  .page { box-shadow: 0 4px 20px rgba(0,0,0,.25); }
}
@media print {
  html, body { background: white; }
  .pw  { display: block; }
  .page { box-shadow: none; }
  .no-print { display: none !important; }
}
/* 置中 */
.pw { min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
.page {
  width: 200mm;
  background: #fff;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── 表頭 ── */
.hdr {
  display: flex;
  align-items: center;
  gap: 3mm;
  padding-bottom: 2mm;
  border-bottom: 1.5px solid #1f2937;
  margin-bottom: 2mm;
}
.hdr-info { flex: 1; }
.facility { font-size: 13pt; font-weight: bold; color: #1f2937; }
.doc-title { font-size: 10pt; font-weight: bold; color: #0f766e; margin-top: 1mm; letter-spacing: .5pt; }
.hdr-fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1mm 3mm;
  margin-top: 2mm;
  font-size: 8pt;
}
.hdr-field { display: flex; gap: 1mm; align-items: baseline; }
.hdr-label { color: #555; white-space: nowrap; }
.hdr-val { border-bottom: 1px solid #888; flex: 1; min-width: 20mm; font-weight: 600; }
.hdr-meal {
  margin-top: 2.5mm;
  padding: 1.5mm 2mm;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 2mm 5mm;
  font-size: 8.5pt;
}
.hdr-meal-item { display: flex; gap: 1.5mm; align-items: center; }
.hdr-meal-label { color: #166534; font-weight: 700; white-space: nowrap; }
.hdr-meal-val { color: #14532d; font-weight: 600; }
.hdr-meal-tag {
  display: inline-block;
  background: #dcfce7;
  border: 1px solid #86efac;
  border-radius: 3px;
  padding: 0 3px;
  font-size: 8pt;
  color: #166534;
  font-weight: 600;
}

/* ── 主表格 ── */
.io-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.io-table th, .io-table td {
  border: 0.5pt solid #6b7280;
  vertical-align: middle;
  padding: 0.3mm 0.8mm;
  font-size: 7pt;
  overflow: hidden;
  line-height: 1.2;
}
.io-table thead th {
  background: #e8eef4;
  font-weight: bold;
  text-align: center;
  font-size: 7pt;
}
.io-table thead .th-group {
  background: #1f2937;
  color: #fff;
  font-size: 7.5pt;
  letter-spacing: 0.3pt;
}
.io-table tbody tr { height: 9mm; }
.io-table tbody tr:nth-child(odd)  { background: #fff; }
.io-table tbody tr:nth-child(even) { background: #f9fafb; }
/* 跨夜分隔：23:00後換班 */
.io-table tbody tr.night-break td { border-top: 1.5pt solid #374151; }

.io-table td.tc { text-align: center; font-weight: 600; font-size: 7.5pt; }
.io-table td.tl { text-align: left; }
.io-table td.tr { text-align: right; }

/* ── 總量統計 ── */
.totals {
  margin-top: 2mm;
  border: 1pt solid #374151;
  border-radius: 2px;
  padding: 2mm 3mm;
  display: flex;
  gap: 6mm;
  align-items: center;
  font-size: 8.5pt;
}
.totals-label { font-weight: bold; color: #334155; }
.totals-item { display: flex; gap: 2mm; align-items: baseline; }
.totals-key { color: #64748b; }
.totals-val { font-weight: 700; font-size: 10pt; color: #1e293b; min-width: 12mm; text-align: right; }
.totals-val.neg { color: #dc2626; }
.totals-val.pos { color: #16a34a; }

/* ── 列印按鈕 ── */
.print-btn {
  position: fixed; top: 12px; right: 12px;
  background: #2563eb; color: #fff; border: none;
  padding: 8px 18px; border-radius: 6px; cursor: pointer;
  font-size: 13px; font-family: inherit; font-weight: 600;
  box-shadow: 0 2px 8px rgba(37,99,235,.4); z-index: 9999;
}
.print-btn:hover { background: #1d4ed8; }
.footer { margin-top: auto; position: relative; height: 30px; display: flex; justify-content: flex-end; }
.page-num { position: absolute; left: 50%; transform: translateX(-50%); font-size: 24px; font-weight: bold; bottom: 0; }
.doc-code { font-size: 11px; font-weight: bold; align-self: flex-end; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">列印</button>
<div class="pw">
<div class="page">
  <!-- 表頭 -->
  <div class="hdr">
    <div class="hdr-info">
      <div class="facility">${esc(facilityName)}</div>
      <div class="doc-title">個人出入量記錄表</div>
      <div class="hdr-fields">
        <div class="hdr-field"><span class="hdr-label">院友姓名：</span><span class="hdr-val">${esc(patientName)}</span></div>
        <div class="hdr-field"><span class="hdr-label">院號/床號：</span><span class="hdr-val">${esc(bedNumber)}</span></div>
        <div class="hdr-field"><span class="hdr-label">性別/年齡：</span><span class="hdr-val">${esc(genderAge)}</span></div>
        <div class="hdr-field"><span class="hdr-label">記錄日期：</span><span class="hdr-val">${esc(recordDate)}</span></div>
        <div class="hdr-field"><span class="hdr-label">目標攝入量：</span><span class="hdr-val">${targetIntakeMl != null ? targetIntakeMl + ' ml/日' : ''}</span></div>
      </div>
      ${(mealCombination || specialDiets.length > 0) ? `
      <div class="hdr-meal">
        ${mealCombination ? `<div class="hdr-meal-item"><span class="hdr-meal-label">餐膳組合：</span><span class="hdr-meal-val">${esc(mealCombination)}</span></div>` : ''}
        ${specialDiets.length > 0 ? `<div class="hdr-meal-item"><span class="hdr-meal-label">特別餐單：</span>${specialDiets.map(d => `<span class="hdr-meal-tag">${esc(d)}</span>`).join('')}</div>` : ''}
      </div>` : ''}
    </div>
  </div>

  <!-- 主表格 -->
  <table class="io-table">
    <colgroup>
      <col style="width:10mm"><!-- 時間 -->
      <col style="width:26mm"><!-- 餐膳 -->
      <col style="width:15mm"><!-- 飲料種類 -->
      <col style="width:15mm"><!-- 飲料ml -->
      <col style="width:15mm"><!-- 鼻胃飼種類 -->
      <col style="width:15mm"><!-- 鼻胃飼ml -->
      <col style="width:20mm"><!-- 其他 -->
      <col style="width:17mm"><!-- 胃液色+pH -->
      <col style="width:18mm"><!-- 胃液ml -->
      <col style="width:12mm"><!-- 尿色 -->
      <col style="width:16mm"><!-- 尿液ml -->
      <col style="width:21mm"><!-- 記錄員+備注 -->
    </colgroup>
    <thead>
      <tr>
        <th rowspan="3">時間</th>
        <th colspan="6" class="th-group">攝　入</th>
        <th colspan="4" class="th-group">排　出</th>
        <th rowspan="3">記錄員<br>備注</th>
      </tr>
      <tr>
        <th rowspan="2">餐膳<br><span style="font-weight:normal;font-size:6pt">早/午/茶/晚</span></th>
        <th colspan="2">飲料</th>
        <th colspan="2">鼻胃飼</th>
        <th rowspan="2">其他</th>
        <th colspan="2">胃液</th>
        <th colspan="2">尿液</th>
      </tr>
      <tr>
        <th>種類</th><th>ml</th>
        <th>種類</th><th>ml</th>
        <th>顏色/pH</th><th>ml</th>
        <th>顏色</th><th>ml</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows}
    </tbody>
  </table>

  <!-- 總量統計 -->
  <div class="totals">
    <span class="totals-label">24小時統計</span>
    <div class="totals-item">
      <span class="totals-key">攝入總量(ml)</span>
      <span class="totals-val">${totalIntakeMl || '—'}</span>
    </div>
    <div class="totals-item">
      <span class="totals-key">排出總量(ml)</span>
      <span class="totals-val">${totalOutputMl || '—'}</span>
    </div>
    <div class="totals-item">
      <span class="totals-key">出入平衡(ml)</span>
      <span class="totals-val ${balance > 0 ? 'pos' : balance < 0 ? 'neg' : ''}">${totalIntakeMl || totalOutputMl ? balanceSign + balance : '—'}</span>
    </div>
  </div>
  <div class="footer">
    <div class="page-num">1</div>
    <div class="doc-code"></div>
  </div>
</div>
</div>
</body>
</html>`;
}

export async function printIntakeOutputForm(input: IntakeOutputHtmlInput): Promise<void> {
  const settings = await getFacilitySettings();
  const html = generateIntakeOutputHtml({
    ...input,
    facilityName: input.facilityName ?? settings.facilityNameZh,
  });
  const old = document.getElementById('io-printframe');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'io-printframe';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => { iframe.contentWindow?.print(); }, 400);
}

// ── DB 記錄 → HTML 行轉換 ───────────────────────────────────────
export interface IntakeOutputDbRecord {
  time_slot: string;
  recorder: string;
  notes?: string | null;
  intake_items?: Array<{
    category: 'meal' | 'beverage' | 'tube_feeding' | 'other';
    item_type: string;
    amount?: string;
    amount_numeric: number;
    unit: string;
  }>;
  output_items?: Array<{
    category: 'urine' | 'gastric';
    color?: string;
    ph_value?: number;
    amount_ml: number;
  }>;
}

export const convertDbRecordToRow = (r: IntakeOutputDbRecord): IntakeOutputRowInput => {
  const intake = r.intake_items ?? [];
  const output = r.output_items ?? [];
  const meals = intake.filter(i => i.category === 'meal');
  const mealLabel: Record<string, string> = { '早餐':'早','午餐':'午','下午茶':'茶','晚餐':'晚' };
  const mealText = meals.map(m => `${mealLabel[m.item_type] ?? m.item_type} ${m.amount ?? ''}`.trim()).join(' ') || undefined;
  const bev = intake.filter(i => i.category === 'beverage');
  const tube = intake.filter(i => i.category === 'tube_feeding');
  const other = intake.filter(i => i.category === 'other');
  const gastric = output.find(o => o.category === 'gastric');
  const urine = output.find(o => o.category === 'urine');
  return {
    time_slot: r.time_slot,
    meal: mealText,
    beverage_type: bev.map(i => i.item_type).join('/') || undefined,
    beverage_ml: bev.reduce((s, i) => s + (i.amount_numeric || 0), 0) || undefined,
    tube_type: tube.map(i => i.item_type).join('/') || undefined,
    tube_ml: tube.reduce((s, i) => s + (i.amount_numeric || 0), 0) || undefined,
    other: other.map(i => `${i.item_type}${i.amount ?? ''}`).join(' ') || undefined,
    gastric_color_ph: gastric ? `${gastric.color ?? ''}${gastric.ph_value ? ` pH${gastric.ph_value}` : ''}`.trim() || undefined : undefined,
    gastric_ml: gastric?.amount_ml || undefined,
    urine_color: urine?.color || undefined,
    urine_ml: urine?.amount_ml || undefined,
    recorder: r.recorder,
    notes: r.notes ?? undefined,
  };
};

// ── 日期範圍版匯出（每天一頁）──────────────────────────────────
export interface IntakeOutputRecordWithDate extends IntakeOutputDbRecord {
  record_date: string;  // 'YYYY-MM-DD'
}

export const generateIntakeOutputRangeHtml = (
  baseInput: Omit<IntakeOutputHtmlInput, 'recordDate' | 'rows'>,
  allRecords: IntakeOutputRecordWithDate[],
  startDate: string,
  endDate: string,
  facilityName: string
): string[] => {
  const days: string[] = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  const pages = days.map(dateStr => {
    const d = new Date(dateStr);
    const displayDate = formatDisplayDate(d);
    const dayRecords = allRecords.filter(r => r.record_date === dateStr);
    const rows = dayRecords.map(convertDbRecordToRow);
    return generateIntakeOutputHtml({ ...baseInput, facilityName, recordDate: displayDate, rows });
  });
  // 出入量頁面用 .page 類別，需額外注入 page-break
  return pages.map((p, i) =>
    i === 0 ? p.replace('</style>', '.page { page-break-after: always; break-after: page; }\n</style>') : p
  );
};

export const exportIntakeOutputRangeHtml = async (
  baseInput: Omit<IntakeOutputHtmlInput, 'recordDate' | 'rows'>,
  allRecords: IntakeOutputRecordWithDate[],
  startDate: string,
  endDate: string
): Promise<void> => {
  const settings = await getFacilitySettings();
  const facilityName = baseInput.facilityName ?? settings.facilityNameZh;
  const pages = generateIntakeOutputRangeHtml(baseInput, allRecords, startDate, endDate, facilityName);
  import('./printUtils').then(({ printCombinedHtml }) => {
    printCombinedHtml(pages, 'io-printframe');
  });
};
