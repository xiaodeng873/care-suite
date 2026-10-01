/**
 * 藥條標簽貼紙列印產生器
 * A4 直向彩印，每院友 80 張 20×20mm 貼紙（紅16・黃16・綠16・藍16・白16），
 * 8 欄排列、每色兩行、一頁一位院友；剪出後貼於 2×2×2cm 藥條格面
 */

import type { Patient } from '../lib/database';
import { getPrintBedNumber } from './bedTransferUtils';

const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface StickerColor {
  count: number;
  bandClass: string;
  textClass: string;
}

// 紅＝早餐、黃＝午餐、綠＝晚餐、藍＝其他、白＝宵夜
const STICKER_COLORS: StickerColor[] = [
  { count: 16, bandClass: 'ms-b-red', textClass: 'ms-t-red' },
  { count: 16, bandClass: 'ms-b-yel', textClass: 'ms-t-yel' },
  { count: 16, bandClass: 'ms-b-grn', textClass: 'ms-t-grn' },
  { count: 16, bandClass: 'ms-b-blu', textClass: 'ms-t-blu' },
  { count: 16, bandClass: 'ms-b-wht', textClass: 'ms-t-wht' },
];

const STICKERS_PER_ROW = 8;

const renderSticker = (bed: string, name: string, color: StickerColor): string =>
  `<div class="ms-sticker"><div class="ms-band ${color.bandClass}"></div><div class="ms-who ${color.textClass}">${bed} ${name}</div><div class="ms-zone"></div></div>`;

const renderPatientPage = (patient: Patient): string => {
  const bed = esc(getPrintBedNumber(patient));
  const name = esc(patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`);

  const rows: string[] = [];
  for (const color of STICKER_COLORS) {
    for (let i = 0; i < color.count; i += STICKERS_PER_ROW) {
      const stickers: string[] = [];
      for (let j = i; j < Math.min(i + STICKERS_PER_ROW, color.count); j++) {
        stickers.push(renderSticker(bed, name, color));
      }
      rows.push(`<div class="ms-row">${stickers.join('')}</div>`);
    }
  }

  return `
    <div class="ms-page">
      <div class="ms-title">藥條標簽貼紙</div>
      <div class="ms-sub">每張 20×20mm ・ 沿虛線剪出 ・ 貼於藥條格面 ・ 每院友 80 張（紅＝早餐 ×16・黃＝午餐 ×16・綠＝晚餐 ×16・藍＝其他 ×16・白＝宵夜 ×16）</div>
      <div class="ms-label">${bed}　${name}（紅×16・黃×16・綠×16・藍×16・白×16，共 80 張）</div>
      ${rows.join('\n')}
    </div>
  `.trim();
};

export const generateMedStripStickerHtml = (patients: Patient[]): string => {
  const pages = patients.map(renderPatientPage);
  if (pages.length === 0) {
    pages.push('<div class="ms-page"></div>');
  }

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>藥條標簽貼紙</title>
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
  font-family: "Microsoft JhengHei", "PingFang HK", "Noto Sans TC", sans-serif;
  background: #fff;
}
.ms-page {
  width: 210mm;
  height: 297mm;
  padding: 10mm;
  page-break-after: always;
}
.ms-page:last-child {
  page-break-after: auto;
}
.ms-title {
  font-size: 13pt;
  font-weight: bold;
  text-align: center;
  margin-bottom: 1mm;
}
.ms-sub {
  font-size: 8pt;
  text-align: center;
  color: #555;
  margin-bottom: 6mm;
}
.ms-label {
  font-size: 9pt;
  font-weight: bold;
  margin-bottom: 2mm;
  border-bottom: 1px solid #999;
  padding-bottom: 1mm;
}
.ms-row {
  display: flex;
  gap: 4mm;
  margin-bottom: 4mm;
}
.ms-sticker {
  width: 20mm;
  height: 20mm;
  border: 0.25mm dashed #94a3b8;
  display: flex;
  flex-direction: column;
  background: #fff;
  flex-shrink: 0;
}
.ms-band {
  height: 1.2mm;
  flex-shrink: 0;
}
.ms-b-red { background: #ef4444; }
.ms-b-yel { background: #facc15; }
.ms-b-grn { background: #22c55e; }
.ms-b-blu { background: #3b82f6; }
.ms-b-wht { background: #fff; border-bottom: 0.2mm solid #cbd5e1; }
.ms-who {
  font-size: 5.2pt;
  font-weight: bold;
  text-align: center;
  padding: 0.3mm 0.5mm;
  white-space: nowrap;
  overflow: hidden;
  flex-shrink: 0;
}
.ms-t-red { color: #b91c1c; }
.ms-t-yel { color: #a16207; }
.ms-t-grn { color: #15803d; }
.ms-t-wht { color: #334155; }
.ms-t-blu { color: #1d4ed8; }
.ms-zone {
  flex: 1;
  margin: 0.6mm;
  border: 0.2mm dashed #cbd5e1;
}
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
};
