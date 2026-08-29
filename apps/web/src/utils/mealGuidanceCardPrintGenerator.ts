/**
 * 餐膳指引卡片列印產生器
 * A4 橫向，每頁最多 2 行 × 3 列 = 6 張卡片
 * 頂部色帶使用院友居住區的代表色
 */

import type { Patient, MealGuidance, Station } from '../lib/database';
import { getPrintBedNumber } from './bedTransferUtils';

const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderMealInfo = (g: MealGuidance | undefined): string => {
  if (!g) return '<div class="mg-empty">—</div>';

  const lines: string[] = [];

  if (g.meal_combination) {
    lines.push(`<div class="mg-line"><span class="mg-label">餐類：</span>${esc(g.meal_combination)}</div>`);
  }

  if (g.special_diets && g.special_diets.length > 0) {
    lines.push(
      `<div class="mg-line"><span class="mg-label">特殊：</span>${esc(g.special_diets.join('、'))}</div>`
    );
  }

  if (g.needs_thickener) {
    const amount = g.thickener_amount ? esc(g.thickener_amount) : '需要';
    lines.push(`<div class="mg-line"><span class="mg-label">凝固粉：</span>${amount}</div>`);
  }

  if (g.needs_feeding) {
    const tubeInfo = [g.tube_feeding_brand, g.tube_feeding_daily_amount_ml ? `${g.tube_feeding_daily_amount_ml}ml` : '']
      .filter(Boolean)
      .join(' ');
    lines.push(`<div class="mg-line"><span class="mg-label">喉管餵飼：</span>${esc(tubeInfo) || '需要'}</div>`);
  }

  if (g.egg_quantity) {
    lines.push(`<div class="mg-line"><span class="mg-label">雞蛋：</span>${g.egg_quantity} 隻</div>`);
  }

  if (lines.length === 0) {
    return '<div class="mg-empty">—</div>';
  }

  return `<div class="mg-info">${lines.join('')}</div>`;
};

const renderCard = (patient: Patient, guidance: MealGuidance | undefined, stationColor: string): string => {
  const bedNumber = esc(getPrintBedNumber(patient));
  const patientName = esc(patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`);
  const photoUrl = patient.院友相片 || '';
  const remark = esc(guidance?.remarks || '');
  const headerStyle = `background-color: ${esc(stationColor)}; color: #000;`;

  return `
    <div class="mg-card">
      <div class="mg-header" style="${headerStyle}">
        <div class="mg-bed">${bedNumber}</div>
        <div class="mg-name">${patientName}</div>
      </div>
      <div class="mg-body">
        <div class="mg-photo-area">
          ${photoUrl ? `<img class="mg-photo" src="${esc(photoUrl)}" alt="">` : '<div class="mg-no-photo">—</div>'}
        </div>
        <div class="mg-details">
          ${renderMealInfo(guidance)}
        </div>
      </div>
      <div class="mg-footer">
        <span class="mg-label">備註：</span>${remark || '—'}
      </div>
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

  // 每頁最多 6 張（2 行 × 3 列）
  const cardsPerPage = 6;
  const pages: string[] = [];
  for (let i = 0; i < patients.length; i += cardsPerPage) {
    const pagePatients = patients.slice(i, i + cardsPerPage);
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
  size: A4 landscape;
  margin: 10mm;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  padding: 0;
  font-family: "Microsoft JhengHei", "PingFang HK", "MingLiU", sans-serif;
  background: #fff;
}
.mg-page {
  width: 277mm;
  height: 190mm;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 89mm);
  grid-template-rows: repeat(2, 92.5mm);
  gap: 5mm;
  page-break-after: always;
  box-sizing: content-box;
}
.mg-page:last-child {
  page-break-after: auto;
}
.mg-card {
  width: 89mm;
  height: 92.5mm;
  border: 1pt solid #000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}
.mg-header {
  height: 18mm;
  padding: 2mm 3mm;
  display: flex;
  align-items: center;
  gap: 3mm;
  border-bottom: 1pt solid #000;
}
.mg-bed {
  font-size: 22pt;
  font-weight: bold;
  white-space: nowrap;
}
.mg-name {
  font-size: 22pt;
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
  width: 40mm;
  min-width: 40mm;
  border-right: 1pt solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2mm;
  background: #f9fafb;
}
.mg-photo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.mg-no-photo {
  font-size: 14pt;
  color: #9ca3af;
}
.mg-details {
  flex: 1;
  padding: 2mm 3mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
.mg-info {
  display: flex;
  flex-direction: column;
  gap: 1.5mm;
}
.mg-line {
  font-size: 16pt;
  line-height: 1.3;
  word-break: break-word;
}
.mg-label {
  font-weight: bold;
}
.mg-empty {
  font-size: 16pt;
  color: #9ca3af;
}
.mg-footer {
  height: 16.5mm;
  padding: 2mm 3mm;
  font-size: 14pt;
  line-height: 1.3;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.mg-footer .mg-label {
  white-space: nowrap;
  margin-right: 1mm;
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
