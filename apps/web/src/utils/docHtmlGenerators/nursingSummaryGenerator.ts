/**
 * 護理摘要 HTML 產生器（床頭卡式一頁速覽）
 * A4 橫向，每院友一頁：左方勾選格（餐類組合/特殊餐膳/流質/活動能力/排泄能力/約束衣物），
 * 右方自理能力/特別護理/扶抱/備註。
 * data 模式由 ctx.mealGuidances 映射餐膳指引（餐類組合、特殊餐膳、凝固粉配方及分量）；
 * basic/blank 模式為空白手寫表格。
 */

import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';
import type { MealCombinationType, SpecialDietType } from '../../lib/database';
import { getPrintBedNumber } from '../bedTransferUtils';

const MEAL_COMBINATIONS: MealCombinationType[] = [
  '正飯+正餸', '正飯+碎餸', '正飯+糊餸', '軟飯+正餸', '軟飯+碎餸', '軟飯+糊餸', '全糊', '不適用',
];

const SPECIAL_DIETS: SpecialDietType[] = ['糖尿餐', '痛風餐', '低鹽餐', '鼻胃飼', '雞蛋', '素食'];

const CARE_ABILITY = ['全自理', '需協助', '全護理'];

/** 實線書寫底線（不可用虛線） */
const u = (widthMm: number): string => `<span class="ns-u" style="width:${widthMm}mm">&nbsp;</span>`;

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** items 係已 escape 好、可含 <span class="ns-u"> 底線 嘅安全 HTML */
const sectionHtml = (
  title: string,
  items: string[],
  cols: number,
  checked: (label: string) => boolean
): string => {
  const rows = chunk(items, cols)
    .map(
      (row) =>
        `<tr>${row
          .map((label) => `<td>${checked(label) ? '☑' : '□'} ${label}</td>`)
          .join('')}${row.length < cols ? `<td colspan="${cols - row.length}"></td>` : ''}</tr>`
    )
    .join('');
  return `
    <div class="ns-sec">
      <div class="ns-sec-title">${escapeHtml(title)}</div>
      <table class="ns-sec-table">${rows}</table>
    </div>
  `;
};

const checklistHtml = (title: string, items: string[]): string => `
  <div class="ns-group">
    <div class="ns-group-title">${escapeHtml(title)}</div>
    <div class="ns-checks">${items.map((label) => `<div class="ns-check">□ ${label}</div>`).join('')}</div>
  </div>
`;

export function generateNursingSummaryHtml(ctx: DocumentGeneratorContext): string {
  const { patient, facilityName, contentMode } = ctx;
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const bed = getPrintBedNumber(patient);

  // data 模式：由餐膳指引映射餐類組合、特殊餐膳、凝固粉配方及分量
  const guidance = contentMode === 'data'
    ? (ctx.mealGuidances || []).find(g => g.patient_id === patient.院友id)
    : undefined;

  const mealChecked = (label: string): boolean => guidance?.meal_combination === label;
  const dietChecked = (label: string): boolean => !!guidance?.special_diets?.includes(label as SpecialDietType);

  // 凝固粉：映射配方及分量；冇數據就留空白底線
  const thickenerLabel = guidance?.needs_thickener
    ? `凝固粉：${escapeHtml(guidance.thickener_formula || '普通配方')}${guidance.thickener_amount ? ` ${escapeHtml(guidance.thickener_amount)}` : ` 分量${u(14)}`}`
    : `凝固粉：配方${u(14)} 分量${u(14)}`;

  const specialCareLabels = [
    '每兩小時協助轉身',
    '口腔護理',
    `鼻胃飼 每日${u(8)}餐 ${u(12)}ml + H₂O ${u(12)}ml`,
    '尿喉護理',
    '傷口護理',
    '血液透析',
    '腹膜透析',
    `長期氧氣治療（O₂）${u(12)}L/min`,
    '遊走風險高',
  ];

  const liftingLabels = ['單人扶抱', '雙人扶抱', `輔助工具（註明：${u(30)}）`];

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>護理摘要</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
    margin: 0;
    color: #1e293b;
    line-height: 1.25;
  }
  .ns-u { display: inline-block; border-bottom: 0.8pt solid #475569; height: 1em; }
  .ns-head { text-align: center; }
  .ns-facility { font-size: 15px; font-weight: bold; color: #0f766e; letter-spacing: 1px; }
  .ns-title { font-size: 20px; font-weight: bold; letter-spacing: 4px; margin: 1mm 0; color: #334155; }
  .ns-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: bold;
    border: 0.75pt solid #99f6e4;
    background: #f0fdfa;
    border-radius: 1.5mm;
    padding: 1.5mm 2.5mm;
    margin: 2mm 0 3mm;
    color: #134e4a;
  }
  .ns-body { display: flex; gap: 4mm; }
  .ns-left { width: 62%; }
  .ns-right { flex: 1; }
  .ns-sec { border: 0.75pt solid #99f6e4; border-radius: 1.5mm; overflow: hidden; margin-bottom: 3mm; }
  .ns-sec-title {
    background: #ccfbf1;
    color: #0f766e;
    font-size: 10.5px;
    font-weight: bold;
    padding: 1mm 2mm;
    border-bottom: 0.75pt solid #99f6e4;
  }
  .ns-sec-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .ns-sec-table td {
    border: 0.5pt solid #e2e8f0;
    font-size: 10px;
    padding: 1.6mm 1.5mm;
    height: 8mm;
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;
  }
  .ns-group { border: 0.75pt solid #99f6e4; border-radius: 1.5mm; overflow: hidden; margin-bottom: 3mm; }
  .ns-group-title {
    background: #ccfbf1;
    color: #0f766e;
    font-size: 10.5px;
    font-weight: bold;
    padding: 1mm 2mm;
    border-bottom: 0.75pt solid #99f6e4;
  }
  .ns-checks { padding: 1mm 2mm 1.5mm; }
  .ns-check { font-size: 10px; padding: 0.9mm 0; white-space: nowrap; }
  .ns-remark-lines { padding: 1mm 2mm; }
  .ns-remark-line { border-bottom: 0.8pt solid #94a3b8; height: 7mm; }
  .ns-foot { margin-top: 2mm; font-size: 9.5px; color: #64748b; }
  .ns-hint { margin-bottom: 1mm; color: #0f766e; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="ns-head">
    <div class="ns-facility">${escapeHtml(facilityName)}</div>
    <div class="ns-title">護理摘要</div>
  </div>
  <div class="ns-meta">
    <span>床號：${escapeHtml(bed)}</span>
    <span>院友姓名：${escapeHtml(patientName)}</span>
    <span>更新日期：${u(24)}</span>
    <span>職員簽署：${u(24)}</span>
  </div>
  <div class="ns-body">
    <div class="ns-left">
      ${sectionHtml('餐類組合', MEAL_COMBINATIONS.map(escapeHtml), 4, mealChecked)}
      ${sectionHtml('特殊餐膳', SPECIAL_DIETS.map(escapeHtml), 4, dietChecked)}
      ${sectionHtml('流質', ['正常', thickenerLabel, `每日限水${u(10)}L`, '每天鼓勵進水'], 3, () => false)}
      ${sectionHtml('活動能力', ['自行走動', '拐杖', '助行架', '輪椅', '長期臥床', '跌倒風險'], 4, () => false)}
      ${sectionHtml('排泄能力', ['使用尿片', '正常如廁', '尿壺', '便椅', '尿喉'], 4, () => false)}
      ${sectionHtml('約束衣物', ['安全衣', '防滑襪', '保護手套', '手腕帶', '安全帶'], 4, () => false)}
    </div>
    <div class="ns-right">
      ${checklistHtml('自理能力', CARE_ABILITY)}
      ${checklistHtml('特別護理', specialCareLabels)}
      ${checklistHtml('扶抱', liftingLabels)}
      <div class="ns-group">
        <div class="ns-group-title">備註</div>
        <div class="ns-remark-lines">
          <div class="ns-remark-line"></div>
          <div class="ns-remark-line"></div>
          <div class="ns-remark-line"></div>
        </div>
      </div>
      <div class="ns-foot">
        <div class="ns-hint">#請用紅色白板筆圈出適用項目。</div>
        <div>Last Updated: ${u(24)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const escapeHtml = (text: string): string => {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};
