/**
 * 雜費記錄報表 HTML 產生器
 * 支援 A4 卡片式列印：每頁最多 6 位院友（2 列 × 3 行），
 * 每位院友一個卡片，最多 8 項記錄；超過則自動佔用下一個卡片位置。
 */

import type { Patient, FeeItem, PatientFeeRecord } from '../lib/database';
import { getFacilitySettings } from './facilitySettings';
import { getPrintBedNumber } from './bedTransferUtils';
import { formatDisplayDate } from './dateFormat';

export interface FeeStatementLineItem {
  date: string;
  itemName: string;
  start_time?: string | null;
  end_time?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  notes?: string | null;
}

const MAX_CARD_ROWS = 8;
const CARDS_PER_PAGE = 6;
const CARDS_PER_ROW = 2;

export interface FeeStatisticsReportOptions {
  month: string; // YYYY-MM
  skipEmptyPatients?: boolean;
  facilityName: string;
}

export interface FeeStatisticsReportCard {
  patient: Patient;
  month: string;
  cardIndex: number; // 0 = first card for this patient
  items: FeeStatementLineItem[];
  subtotal: number;
  isContinuation: boolean;
}

/** Build cards for each patient: one card holds up to MAX_CARD_ROWS items; overflow creates continuation cards. */
export const buildFeeStatisticsCards = (
  patients: Patient[],
  records: PatientFeeRecord[],
  feeItems: FeeItem[],
  month: string,
  skipEmptyPatients: boolean
): FeeStatisticsReportCard[] => {
  const cards: FeeStatisticsReportCard[] = [];
  for (const patient of patients) {
    const patientRecords = records.filter(
      r => r.patient_id === patient.院友id && r.record_date.startsWith(month)
    );
    if (skipEmptyPatients && patientRecords.length === 0) continue;

    const items = patientRecords
      .sort((a, b) => a.record_date.localeCompare(b.record_date) || (a.created_at || '').localeCompare(b.created_at || ''))
      .map(record => {
        const feeItem = record.fee_item_id
          ? feeItems.find(item => item.id === record.fee_item_id)
          : undefined;
        const dateText = formatDisplayDate(record.record_date, '');
        const timeText =
          record.unit === '小時' && record.start_time && record.end_time
            ? ` ${record.start_time}-${record.end_time}`
            : '';
        return {
          date: `${dateText}${timeText}`,
          itemName: feeItem?.name_zh || record.item_name,
          quantity: record.quantity,
          unit: record.unit,
          unitPrice: record.unit_price,
          amount: record.amount,
          notes: record.notes,
        } satisfies FeeStatementLineItem;
      });

    const chunks = chunkItems(items, MAX_CARD_ROWS);
    chunks.forEach((chunk, idx) => {
      cards.push({
        patient,
        month,
        cardIndex: idx,
        items: chunk,
        subtotal: chunk.reduce((sum, item) => sum + item.amount, 0),
        isContinuation: idx > 0,
      });
    });
  }
  return cards;
};

const chunkItems = (items: FeeStatementLineItem[], size: number): FeeStatementLineItem[][] => {
  const chunks: FeeStatementLineItem[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks.length === 0 ? [[]] : chunks;
};

const cardHtml = (card: FeeStatisticsReportCard): string => {
  const patient = card.patient;
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const bed = getPrintBedNumber(patient);
  const monthLabel = formatMonthLabel(card.month);
  const titleSuffix = card.isContinuation ? '（續）' : '';

  const rows = Array.from({ length: MAX_CARD_ROWS }).map((_, i) => {
    const item = card.items[i];
    if (!item) {
      return '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>';
    }
    return `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${escapeHtml(item.itemName)}</td>
        <td>${escapeHtml(item.notes || '')}</td>
        <td>${formatMoney(item.amount)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="fee-card">
      <div class="fee-card-header">
        <div class="fee-card-bed">${escapeHtml(bed)}</div>
        <div class="fee-card-name">${escapeHtml(patientName)}${titleSuffix}</div>
        <div class="fee-card-month">${monthLabel}</div>
      </div>
      <table class="fee-card-table">
        <thead>
          <tr>
            <th style="width: 20%;">日期</th>
            <th style="width: 40%;">項目</th>
            <th style="width: 22%;">備註</th>
            <th style="width: 18%;">金額</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="fee-card-total">
            <td colspan="3" style="text-align: right; font-weight: bold;">合計</td>
            <td style="font-weight: bold;">${formatMoney(card.subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

const formatMonthLabel = (month: string): string => {
  const [year, mon] = month.split('-');
  return `${year}年${mon}月`;
};

const feeStatisticsPageHtml = (pageCards: FeeStatisticsReportCard[], facilityName: string): string => {
  const cardsHtml = pageCards.map(cardHtml).join('');
  return `
    <div class="page fee-statistics-page">
      <div class="fee-statistics-title">
        <h1>${escapeHtml(facilityName)}</h1>
        <h2>雜費記錄報表</h2>
      </div>
      <div class="fee-card-grid">
        ${cardsHtml}
      </div>
    </div>
  `;
};

const feeStatisticsWrapHtml = (pages: string, facilityName: string): string => `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <title>雜費記錄報表</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", sans-serif;
      margin: 0;
      padding: 0;
      background: #f4f4f4;
      color: #000;
      line-height: 1.3;
      font-size: 12px;
    }
    .no-print { text-align: center; margin: 10px; }
    .no-print button {
      padding: 8px 20px;
      font-size: 14px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .page {
      width: 100%;
      min-height: 277mm;
      background: #fff;
      page-break-after: always;
      padding: 6mm;
    }
    .page:last-of-type { page-break-after: auto; }
    .fee-statistics-title { text-align: center; margin-bottom: 8px; }
    .fee-statistics-title h1 { margin: 0; font-size: 18px; font-weight: bold; }
    .fee-statistics-title h2 { margin: 4px 0 0 0; font-size: 16px; font-weight: bold; }
    .fee-card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(3, 1fr);
      gap: 6mm;
      height: 245mm;
    }
    .fee-card {
      border: 1px solid #000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .fee-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 6px;
      border-bottom: 1px solid #000;
      background: #f0f0f0;
      font-weight: bold;
      font-size: 13px;
      flex-wrap: nowrap;
    }
    .fee-card-bed { min-width: 36px; }
    .fee-card-name { flex: 1; }
    .fee-card-month { margin-left: auto; font-size: 12px; }
    .fee-card-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      flex: 1;
    }
    .fee-card-table th, .fee-card-table td {
      border: 1px solid #000;
      text-align: center;
      vertical-align: middle;
      padding: 2px 3px;
      font-size: 11px;
    }
    .fee-card-table th { background-color: #f9f9f9; font-weight: bold; }
    .fee-card-table td { height: 18px; }
    .fee-card-total td { background-color: #fafafa; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .page { box-shadow: none; margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">列印</button></div>
  ${pages}
</body>
</html>`;

/** Generate an A4 report with up to 6 patient cards (2 cols x 3 rows) per page. */
export const generateFeeStatisticsReportHtml = (
  patients: Patient[],
  records: PatientFeeRecord[],
  feeItems: FeeItem[],
  options: FeeStatisticsReportOptions
): string => {
  const cards = buildFeeStatisticsCards(patients, records, feeItems, options.month, options.skipEmptyPatients ?? false);
  const pages: string[] = [];
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) {
    pages.push(feeStatisticsPageHtml(cards.slice(i, i + CARDS_PER_PAGE), options.facilityName));
  }
  return feeStatisticsWrapHtml(pages.join(''), options.facilityName);
};

export async function printFeeStatisticsReport(
  patients: Patient[],
  records: PatientFeeRecord[],
  feeItems: FeeItem[],
  options: FeeStatisticsReportOptions
): Promise<void> {
  const html = generateFeeStatisticsReportHtml(patients, records, feeItems, options);
  const old = document.getElementById('fee-statistics-report-print-iframe');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'fee-statistics-report-print-iframe';
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
  return text.replace(/[&<>"']/g, m => map[m]);
};

const formatMoney = (value: number): string =>
  Number(value).toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
