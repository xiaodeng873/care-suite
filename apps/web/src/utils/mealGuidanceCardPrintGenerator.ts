/**
 * 餐膳指引卡片列印產生器
 * A4 直向，每頁 2 列 × 3 行 = 6 張卡片（97mm × 76mm 橫向，圓角）
 * 頂部色帶使用院友居住區的代表色；全卡標楷體
 */

import type { Patient, MealGuidance, Station, MealCombinationType } from '../lib/database';
import { getPrintBedNumber } from './bedTransferUtils';

const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 餐膳區塊文字行：無「餐類：」「特殊：」等開首字眼，直接寫內容；特殊餐及備註分段用紅色 */
const renderMealInfo = (g: MealGuidance | undefined): string => {
  if (!g) return '';

  const lines: string[] = [];

  if (g.meal_combination) {
    // 舊記錄「糊飯+糊餸」統一印「全糊」；「N飯+N餸」拆兩行印
    const mc = g.meal_combination === ('糊飯+糊餸' as MealCombinationType) ? '全糊' : g.meal_combination;
    for (const part of mc.split('+')) {
      lines.push(`<div class="mg-line">${esc(part)}</div>`);
    }
  }

  const tubeInfo = g.needs_feeding
    ? [g.tube_feeding_brand, g.tube_feeding_daily_amount_ml ? `${g.tube_feeding_daily_amount_ml}ml` : '']
        .filter(Boolean)
        .join(' ')
    : '';

  if (g.special_diets && g.special_diets.length > 0) {
    for (const diet of g.special_diets) {
      if (diet === '雞蛋') continue; // 由下方「雞蛋 N 隻」行顯示，避免重複
      if (diet === '鼻胃飼' && tubeInfo) continue; // 由喉管餵飼行顯示，避免重複
      lines.push(`<div class="mg-line mg-line-red">${esc(diet)}</div>`);
    }
  }

  if (tubeInfo) {
    lines.push(`<div class="mg-line mg-line-red">${esc(tubeInfo)}</div>`);
  }

  if (g.egg_quantity) {
    lines.push(`<div class="mg-line mg-line-red">雞蛋 ${g.egg_quantity} 隻</div>`);
  }

  // 備註全部映射入餐膳區塊，以分號（半/全形）分段，每段一行
  if (g.remarks) {
    for (const segment of g.remarks.split(/[;；]/)) {
      const trimmed = segment.trim();
      if (trimmed) lines.push(`<div class="mg-line mg-line-red">${esc(trimmed)}</div>`);
    }
  }

  if (lines.length === 0) return '';

  return `<div class="mg-info">${lines.join('')}</div>`;
};

/** 備註列：有用凝固粉就寫，清透配方先加注；空白唔加「—」 */
const renderFooterRemark = (g: MealGuidance | undefined): string => {
  const parts: string[] = [];
  if (g?.needs_thickener) {
    const amount = g.thickener_amount ? ` ${esc(g.thickener_amount)}` : '';
    parts.push(`凝固粉${amount}${g.thickener_formula === '清透配方' ? '（清透配方）' : ''}`);
  }
  return `<div class="mg-footer"><span class="mg-footer-label">備註：</span>${parts.join('；')}</div>`;
};

const renderCard = (patient: Patient, guidance: MealGuidance | undefined, stationColor: string): string => {
  const bedNumber = esc(getPrintBedNumber(patient));
  const patientName = esc(patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`);
  const photoUrl = patient.院友相片 || '';
  const headerStyle = `background-color: ${esc(stationColor)}; color: #000;`;

  return `
    <div class="mg-card">
      <div class="mg-header" style="${headerStyle}">
        <div class="mg-bed">${bedNumber}</div>
        <div class="mg-name">${patientName}</div>
      </div>
      <div class="mg-body">
        <div class="mg-photo-area">
          ${photoUrl ? `<img class="mg-photo" src="${esc(photoUrl)}" alt="">` : ''}
        </div>
        <div class="mg-details">
          ${renderMealInfo(guidance)}
        </div>
      </div>
      ${renderFooterRemark(guidance)}
    </div>
  `.trim();
};

interface GenerateOptions {
  patients: Patient[];
  mealGuidances: MealGuidance[];
  stations: Station[];
}

export const generateMealGuidanceCardHtml = ({
  patients,
  mealGuidances,
  stations,
}: GenerateOptions): string => {
  const stationMap = new Map(stations.map(s => [s.id, s.color || '#fde047']));
  const guidanceMap = new Map<string, MealGuidance>();

  // 每位院友取最新一份餐膳指引
  const sortedGuidances = [...mealGuidances].sort(
    (a, b) => (b.guidance_date || '').localeCompare(a.guidance_date || '') ||
              (b.created_at || '').localeCompare(a.created_at || '')
  );
  for (const g of sortedGuidances) {
    if (!guidanceMap.has(String(g.patient_id))) {
      guidanceMap.set(String(g.patient_id), g);
    }
  }

  // 喉管餵飼院友不需要餐卡，跳過
  const cardPatients = patients.filter(p => !guidanceMap.get(String(p.院友id))?.needs_feeding);

  // 每頁最多 6 張（2 列 × 3 行）
  const cardsPerPage = 6;
  const pages: string[] = [];
  for (let i = 0; i < cardPatients.length; i += cardsPerPage) {
    const pagePatients = cardPatients.slice(i, i + cardsPerPage);
    const cardsHtml = pagePatients
      .map(p => {
        const guidance = guidanceMap.get(String(p.院友id));
        const color = stationMap.get(p.station_id || '') || '#fde047';
        return renderCard(p, guidance, color);
      })
      .join('\n');

    pages.push(`
      <div class="mg-page">
        ${cardsHtml}
      </div>
    `.trim());
  }

  if (pages.length === 0) {
    pages.push('<div class="mg-page"></div>');
  }

  const bodyContent = pages.join('\n');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>餐膳指引卡片</title>
<style>
@page {
  size: A4 portrait;
  margin: 0;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  padding: 0;
  font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
  background: #fff;
}
/* A4 直向 210×297：左右頁邊 5mm、卡間 6mm；垂直 69mm 白位平分（頁邊+行距各 17.25mm） */
.mg-page {
  width: 210mm;
  height: 297mm;
  padding: 17.25mm 5mm;
  display: grid;
  grid-template-columns: 97mm 97mm;
  grid-template-rows: 76mm 76mm 76mm;
  column-gap: 6mm;
  row-gap: 17.25mm;
  page-break-after: always;
}
.mg-page:last-child {
  page-break-after: auto;
}
.mg-card {
  width: 97mm;
  height: 76mm;
  border: 1pt solid #000;
  border-radius: 3mm;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  font-weight: bold;
}
.mg-header {
  height: 15mm;
  padding: 0 3mm;
  display: flex;
  align-items: center;
  gap: 3mm;
  border-bottom: 1pt solid #000;
}
.mg-bed {
  font-size: 24pt;
  font-weight: bold;
  white-space: nowrap;
}
.mg-name {
  font-size: 24pt;
  font-weight: bold;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mg-body {
  flex: 1;
  display: flex;
  border-bottom: 1pt solid #000;
  min-height: 0;
}
.mg-photo-area {
  width: 50%;
  min-width: 50%;
  border-right: 1pt solid #000;
  background: #f9fafb;
  padding: 1mm;
}
.mg-photo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.mg-details {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1mm 2mm;
  overflow: hidden;
}
.mg-info {
  display: flex;
  flex-direction: column;
  gap: 1mm;
  max-height: 100%;
  overflow: hidden;
}
.mg-line {
  font-size: 25pt;
  line-height: 1.25;
  word-break: break-word;
}
.mg-line-red {
  color: #dc2626;
}
.mg-footer {
  height: 12mm;
  padding: 0 3mm;
  font-size: 15pt;
  line-height: 1.3;
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
}
.mg-footer-label {
  font-weight: bold;
}
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
};
