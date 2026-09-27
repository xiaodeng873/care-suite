// 處方標籤（熱感紙 30mm × 40mm 直向）HTML 產生器
// 佈局：院友中文姓名（頂）→ 藥物名稱 → 服用時間點+劑量（最顯眼，bold 加大）→ 注意事項（置底）
import { formatSlotShortLabel } from './medicationRecordHtmlExporter';

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
}

export interface LabelContent {
  patientName: string;
  drugName: string;
  /** 每個服用時間點一行：「8A × 1粒」；冇時間點嘅 PRN 顯示「需要時 × 1粒」 */
  dosageLines: string[];
  /** 結束日期「#DD/MM/YYYY」；冇輸入數量/日數則 null 唔顯示 */
  endDateLine: string | null;
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

/** 由院友＋處方砌標籤內容（Modal 預覽區塊同 HTML 產生器共用） */
export const buildLabelContent = (
  patient: LabelPatientInput,
  prescription: LabelPrescriptionInput
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
  const endDateRaw = prescription.end_date || prescription.estimated_end_date;
  const endDateLine = hasQtyOrDuration && endDateRaw
    ? `#${formatLabelDate(endDateRaw)}`
    : null;

  return { patientName, drugName: String(prescription.medication_name ?? '').trim(), dosageLines, endDateLine };
};

/** 單張標籤 HTML（40mm × 30mm 橫向，@page 設成標籤尺寸，一頁一張） */
export const renderLabelHtml = (content: LabelContent): string => {
  const endDateHtml = content.endDateLine
    ? `<div class="enddate">${escapeHtml(content.endDateLine)}</div>`
    : '';
  return `<div class="label">
  <div class="name">${escapeHtml(content.patientName)}</div>
  <div class="drug">${escapeHtml(content.drugName)}</div>
  <div class="spacer"></div>
  <div class="slots">${content.dosageLines.map((l) => `<div class="slot">${escapeHtml(l)}</div>`).join('')}</div>
  ${endDateHtml}
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
  .name { font-size: 9pt; font-weight: 700; line-height: 1.15; }
  .drug { font-size: 7.5pt; font-weight: 700; line-height: 1.15; margin-top: 0.5mm;
          word-break: break-all; }
  .spacer { flex: 0 0 auto; min-height: 0.5mm; }
  /* 時間點+劑量直排：每個時間點一行 */
  .slot { font-size: 13pt; font-weight: 900; line-height: 1.25; letter-spacing: 0.2mm; }
  .enddate { margin-top: auto; font-size: 8.5pt; font-weight: 700; line-height: 1.2; }
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
