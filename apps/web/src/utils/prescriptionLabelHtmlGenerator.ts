// 處方標籤（熱感紙 40mm × 30mm 橫向）HTML 產生器
// 佈局兩區：上區＝院友中文姓名＋藥物名稱；分隔線；下區＝服用時間點+劑量（主角，最大最粗）
//          ＋隔日單雙月份指引（如有）＋結束日期（置底）
import { formatSlotShortLabel } from './medicationRecordHtmlExporter';
import { computeEstimatedEndDate } from './estimatedEndDate';

export interface LabelPatientInput {
  中文姓名?: string;
  中文姓氏?: string;
  中文名字?: string;
}

export interface LabelPrescriptionInput {
  medication_name?: string;
  medication_time_slots?: string[];
  dosage_amount?: number | string;
  dosage_unit?: string;
  is_prn?: boolean;
  /** 結束日期：有輸入藥物數量(粒)或服用日數先會產出；顯示「#DD/MM/YYYY」 */
  end_date?: string;
  /** 由藥物數量推算嘅預計結束日期（冇明確 end_date 時用） */
  estimated_end_date?: string;
  medication_quantity?: number | string;
  duration_days?: number | string;
  /** 服藥頻率類型；'every_x_days' 且週期 2（隔日）先會產生單雙月份指引 */
  frequency_type?: string | null;
  frequency_value?: number | null;
  specific_weekdays?: number[] | null;
  daily_frequency?: number | null;
  is_odd_even_day?: string | null;
  /** 開始日期：冇 last_taken_date 時做隔日指引嘅週期錨點 */
  start_date?: string;
  /** 上次服用日期：有嘅話做錨點（同派藥排程一致） */
  last_taken_date?: string | null;
  /** 處方日期：最後錨點後備；推算預計結束日期用 */
  prescription_date?: string;
}

export interface LabelContent {
  patientName: string;
  drugName: string;
  /** 每個服用時間點一行：「8A × 1粒」；冇時間點嘅 PRN 顯示「需要時 × 1粒」 */
  dosageLines: string[];
  /** 結束日期「#DD/MM/YYYY」；冇輸入數量/日數則 null 唔顯示 */
  endDateLine: string | null;
  /** 隔日處方嘅單雙月份指引（每月一行，如「9月單日」）；非隔日處方為 null */
  oddEvenMonths: string[] | null;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatDosage = (p: LabelPrescriptionInput): string => {
  if (!p.dosage_amount) return '';
  const amt = String(p.dosage_amount).trim();
  if (!amt) return '';
  const unit = p.dosage_unit ?? '';
  return /^\d+(\.\d+)?$/.test(amt) ? amt + unit : amt;
};

/**
 * 隔日處方（每 2 日服）嘅單雙月份指引：由當月起逐月列出應單日定雙日派。
 * 錨點同派藥排程（prescriptionSchedule.pickIntervalAnchor）完全一致：
 * 有 last_taken_date 就以佢重定週期（早於 start_date 視為錯誤忽略），
 * 否則用 start_date，再冇就用處方日期。每月 1 號同錨點相差偶數日 → 嗰月單日派；
 * 奇數日 → 雙日派。咁跨月（尤其 31 日月尾）都同實際派藥日一致。
 * 單雙日服（odd_even_days）唔使指引——個別日期單雙固定，一望就知。
 */
export const buildOddEvenMonths = (
  prescription: LabelPrescriptionInput,
  refDate: Date = new Date()
): string[] | null => {
  // 只適用於「隔日」＝ every_x_days 且週期 2；每 3 日或以上週期唔整除月份，唔適用
  if (prescription.frequency_type !== 'every_x_days') return null;
  if (Number(prescription.frequency_value) !== 2) return null;

  const parseDay = (raw: unknown): Date | null => {
    const m = String(raw ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  // 同 pickIntervalAnchor：last_taken_date 優先（早於 start_date 視為手入錯誤忽略）
  const start = parseDay(prescription.start_date);
  const lastTaken = parseDay(prescription.last_taken_date);
  const anchor = (lastTaken && (!start || lastTaken >= start) && lastTaken)
    || start
    || parseDay(prescription.prescription_date);
  if (!anchor) return null; // 冇錨點就唔印指引

  // 月份範圍：由當月到結束日期嗰個月；冇明確結束日期就用預計結束日期；
  // 連預計都冇先出 5 個月
  const startYear = refDate.getFullYear();
  const startMonth = refDate.getMonth(); // 0-based
  const endRaw = prescription.end_date
    || prescription.estimated_end_date
    || computeEstimatedEndDate(prescription)
    || '';
  const em = String(endRaw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  // 右欄每月一行，垂直空間放得落約 6 行，上限 6 個月
  let monthCount = 5;
  if (em) {
    const diff = (Number(em[1]) - startYear) * 12 + (Number(em[2]) - 1 - startMonth) + 1;
    monthCount = Math.min(6, Math.max(1, diff));
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const result: string[] = [];
  for (let i = 0; i < monthCount; i++) {
    const y = startYear + Math.floor((startMonth + i) / 12);
    const m0 = (startMonth + i) % 12;
    const firstOfMonth = new Date(y, m0, 1);
    const diffDays = Math.round((firstOfMonth.getTime() - anchor.getTime()) / DAY_MS);
    result.push(`${m0 + 1}月${diffDays % 2 === 0 ? '單' : '雙'}日`);
  }
  return result;
};

/** 由院友＋處方砌標籤內容（Modal 預覽區塊同 HTML 產生器共用） */
export const buildLabelContent = (
  patient: LabelPatientInput,
  prescription: LabelPrescriptionInput,
  refDate: Date = new Date()
): LabelContent => {
  const patientName = (patient.中文姓名 || `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`).trim();
  const dosage = formatDosage(prescription);
  const doseSuffix = dosage ? ` × ${dosage}` : '';

  const slots = (prescription.medication_time_slots ?? [])
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  let dosageLines: string[];
  if (slots.length > 0) {
    dosageLines = [...new Set(slots)].map((slot) => `${formatSlotShortLabel(slot)}${doseSuffix}`);
  } else if (prescription.is_prn) {
    dosageLines = [`需要時${doseSuffix}`];
  } else {
    dosageLines = dosage ? [dosage] : [];
  }

  const hasQtyOrDuration = Boolean(
    String(prescription.medication_quantity ?? '').trim() || String(prescription.duration_days ?? '').trim()
  );
  const formatLabelDate = (iso: string): string => {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
  };
  // PRN 實際服用次數唔可預計，由藥物數量推算嘅預計完結日期冇意義，唔映射上標籤；
  // 人手輸入嘅 end_date 仍然照印
  const endDateRaw = prescription.end_date || (prescription.is_prn ? '' : prescription.estimated_end_date);
  const endDateLine = hasQtyOrDuration && endDateRaw
    ? `#${formatLabelDate(endDateRaw)}`
    : null;

  const oddEvenMonths = buildOddEvenMonths(prescription, refDate);

  return {
    patientName,
    drugName: String(prescription.medication_name ?? '').trim(),
    dosageLines,
    endDateLine,
    oddEvenMonths,
  };
};

// 時間點行數多過 3 行時自動縮細字體（半 pt 級距），等全部時間點放得落 30mm 高標籤
export const slotFontSizePt = (
  lineCount: number,
  hasEndDate: boolean
): number => {
  if (lineCount <= 0) return 13;
  // 可用高度（mm）＝ 30 − 上下 padding 2.5 − 上區(姓名+藥名) ~7.2 − 分隔線 ~1.2
  //              −（有結束日期 ~3.6）
  const availMm = 30 - (2.5 + 7.2 + 1.2 + (hasEndDate ? 3.6 : 0));
  const pt = availMm / (lineCount * 1.25 * 0.3528);
  return Math.max(6, Math.min(13, Math.floor(pt * 2) / 2));
};

/** 單張標籤 HTML（40mm × 30mm 橫向，@page 設成標籤尺寸，一頁一張） */
export const renderLabelHtml = (content: LabelContent): string => {
  const endDateHtml = content.endDateLine
    ? `<div class="enddate">${escapeHtml(content.endDateLine)}</div>`
    : '';
  const monthsHtml = content.oddEvenMonths
    ? `<div class="months">${content.oddEvenMonths.map((mo) => `<div class="month">${escapeHtml(mo)}；</div>`).join('')}</div>`
    : '';
  const slotPt = slotFontSizePt(
    content.dosageLines.length,
    Boolean(content.endDateLine)
  );
  return `<div class="label">
  <div class="top">
    <div class="name">${escapeHtml(content.patientName)}</div>
    <div class="drug">${escapeHtml(content.drugName)}</div>
  </div>
  <div class="divider"></div>
  <div class="bottom">
    <div class="main">
      <div class="slots">${content.dosageLines.map((l) => `<div class="slot" style="font-size:${slotPt}pt">${escapeHtml(l)}</div>`).join('')}</div>
      ${endDateHtml}
    </div>
    ${monthsHtml}
  </div>
</div>`;
};

const LABEL_CSS = `
  @page { size: 40mm 30mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: "Microsoft JhengHei", "PingFang HK", "Noto Sans HK", sans-serif; color: #000; }
  .label {
    width: 40mm; height: 30mm; overflow: hidden;
    padding: 1.5mm 2mm 1mm;
    display: flex; flex-direction: column;
  }
  .top { flex: 0 0 auto; }
  .name { font-size: 9pt; font-weight: 700; line-height: 1.15; }
  .drug { font-size: 7.5pt; font-weight: 700; line-height: 1.15; margin-top: 0.5mm;
          word-break: break-all; }
  /* 兩區分隔線：上區姓名+藥名，下區其餘 */
  .divider { flex: 0 0 auto; border-top: 0.35mm solid #000; margin: 0.8mm 0; }
  .bottom { flex: 1 1 auto; display: flex; flex-direction: row; min-height: 0; min-width: 0; }
  /* 左區：時間點+劑量為主角，垂直置中；結束日期置底 */
  .main { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .slots { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; min-height: 0; }
  .slot { font-weight: 900; line-height: 1.25; letter-spacing: 0.2mm; }
  .enddate { flex: 0 0 auto; font-size: 8.5pt; font-weight: 700; line-height: 1.2; }
  /* 右欄月份指引：唔佔垂直高度，每月一行分號分隔，左邊分界線 */
  .months { flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center;
            border-left: 0.25mm solid #000; padding-left: 1.2mm; margin-left: 1.5mm;
            font-size: 6.5pt; font-weight: 700; line-height: 1.25; white-space: nowrap; }
`;

/** 完整可列印文件：一頁一張標籤，頁與頁之間硬分頁 */
export const generatePrescriptionLabelDocument = (
  labels: LabelContent[]
): string => {
  const pages = labels.map((content, i) =>
    `<div class="label-page"${i < labels.length - 1 ? ' style="page-break-after: always;"' : ''}>${renderLabelHtml(content)}</div>`
  ).join('\n');
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>處方標籤</title>
<style>${LABEL_CSS}
.label-page { width: 40mm; height: 30mm; overflow: hidden; }
</style>
</head>
<body>
${pages}
</body>
</html>`;
};

/** 一張標籤嘅獨立文件（Modal 預覽/單張列印用） */
export const generateSingleLabelDocument = (
  patient: LabelPatientInput,
  prescription: LabelPrescriptionInput
): string => generatePrescriptionLabelDocument([buildLabelContent(patient, prescription)]);

/** 用 hidden iframe 直接列印標籤（40mm×30mm 橫向，一頁一張）；標籤冇圖片，load 完即印 */
export const printPrescriptionLabels = (labels: LabelContent[]): void => {
  if (typeof document === 'undefined' || labels.length === 0) return;
  const html = generatePrescriptionLabelDocument(labels);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:300px;height:200px;border:0;';
  document.body.appendChild(iframe);
  const cleanup = (): void => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
  const doc = iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow!;
  win.addEventListener('afterprint', () => setTimeout(cleanup, 200));
  const trigger = (): void => { win.focus(); win.print(); };
  if (doc.readyState === 'complete') { setTimeout(trigger, 100); }
  else { win.addEventListener('load', () => setTimeout(trigger, 100)); }
};
