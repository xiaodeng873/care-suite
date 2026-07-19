import type { CgatRecord, Patient } from '../lib/database';
import { getFeeExemptEligibility } from './cgatFeeHelper';

/**
 * 從身份證號碼取出「首 3 位數字 + 尾碼（含括號）」供診症名單使用。
 * 例：X123456(A) → 123(A)
 */
function formatIdForWorksheet(idNumber?: string): string {
  if (!idNumber) return '';
  const match = idNumber.match(/(\D)(\d{3})(?:\d+)?(\(\w+\))?/);
  if (match) {
    const suffix = match[3] ? match[3] : `(${match[1]})`;
    return `${match[2]}${suffix}`;
  }
  return idNumber.slice(0, 4);
}

function getWeekdayLabel(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return weekdays[d.getDay()];
}

function checkedAttr(checked: boolean): string {
  return checked ? 'checked' : '';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** 床號排序：居住區代號 > 房號 > 床號 */
function bedSortKey(bedNumber: string): [string, number, number] {
  const match = bedNumber.match(/^([A-Za-z]+)(\d+)(?:-(\d+))?$/);
  if (!match) return [bedNumber, 0, 0];
  return [match[1].toUpperCase(), parseInt(match[2], 10), parseInt(match[3] || '0', 10)];
}

function compareBed(a: string, b: string): number {
  const [a1, a2, a3] = bedSortKey(a);
  const [b1, b2, b3] = bedSortKey(b);
  if (a1 !== b1) return a1.localeCompare(b1, 'zh-Hant');
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

function buildRow(record: CgatRecord, patient: Patient | undefined): string {
  const 床號 = patient?.床號 ?? '';
  const 姓名 = patient ? `${patient.中文姓氏 || ''}${patient.中文名字 || ''}` : '';
  const id = formatIdForWorksheet(patient?.身份證號碼);

  const isNew = record.case_type === '新症';
  const isOld = record.case_type === '舊症';

  const newCgas = isNew && record.is_cgas;
  const newEol = isNew && record.is_eol;
  const oldCgas = isOld && record.is_cgas;
  const oldEol = isOld && record.is_eol;

  const hasMed = !!record.medication_end_date;
  const individual = record.pharmacy_arrangement === '個別取藥';
  const collective = record.pharmacy_arrangement === '集體取藥';

  const eligibility = getFeeExemptEligibility(patient);
  const feeExempt = eligibility.eligible || record.fee_exempted;

  const remarksLines: string[] = [];
  if (record.reason_referral_letter) remarksLines.push('轉介信');
  if (record.remarks) remarksLines.push(record.remarks);

  return `
    <tr class="data-row">
      <td style="width: 45px; text-align: center; vertical-align: middle;">
        <textarea rows="1" style="text-align:center; writing-mode: vertical-rl; text-orientation: mixed;">${escapeHtml(床號)}</textarea>
      </td>
      <td style="width: 280px; padding: 6px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>姓名：</span>
          <div style="flex:1; margin-right:10px;">
            <textarea rows="1">${escapeHtml(姓名)}</textarea>
          </div>
          <span>*ID：</span>
          <div style="width: 90px;">
            <textarea rows="1">${escapeHtml(id)}</textarea>
          </div>
        </div>
        <div style="height: 115px; border: 0.5px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 15px;">
          貼上外展診症咭
        </div>
      </td>
      <td style="width: 85px;">
        <div class="inner-flex">
          <div class="check-item"><input type="checkbox" ${checkedAttr(newCgas)}> CGAS</div>
          <div style="margin-top: 1px; border-bottom: 1px solid black; width: 90%; margin-left: 5px;">
            <textarea rows="1"></textarea>
          </div>
          <div class="sub-text">轉介部門</div>
          <div class="check-item"><input type="checkbox" ${checkedAttr(newEol)}> EOL</div>
        </div>
      </td>
      <td style="width: 70px; text-align: center;">
        <div class="inner-flex">
          <div class="check-item"><input type="checkbox" ${checkedAttr(oldCgas)}> CGAS</div>
          <div class="check-item" style="margin-bottom: 10px;"><input type="checkbox" ${checkedAttr(oldEol)}> EOL</div>
        </div>
      </td>
      <td style="width: 110px;">
        <div class="inner-flex">
          <div style="margin-bottom: 10px;">
            <div style="display: flex; align-items: flex-end;">
              <input type="checkbox" ${checkedAttr(hasMed)}>
              <div style="flex:1; border-bottom: 1px solid black; margin-right: 5px;">
                <textarea rows="1" style="text-align:center;">${escapeHtml(record.medication_end_date ?? '')}</textarea>
              </div>
            </div>
            <div class="sub-text">藥完日期</div>
          </div>
          <div class="check-item"><input type="checkbox" ${checkedAttr(individual)}> 個別取藥</div>
          <div class="check-item"><input type="checkbox" ${checkedAttr(collective)}> 集體取藥</div>
          <div class="check-item"><input type="checkbox" ${checkedAttr(record.is_urgent_medication)}> 急藥</div>
        </div>
      </td>
      <td style="width: 45px; text-align: center; vertical-align: top;">
        <div style="margin-top: 5px;"><input type="checkbox" ${checkedAttr(record.reason_discharge)}></div>
      </td>
      <td style="width: 45px; text-align: center; vertical-align: top;">
        <div style="margin-top: 5px;"><input type="checkbox" ${checkedAttr(record.reason_sign_letter)}></div>
      </td>
      <td style="width: 105px; padding: 5px 2px;">
        <div class="inner-flex">
          <div>
            <div class="check-item"><input type="checkbox" ${checkedAttr(record.reason_view_report && record.report_bld)}> Bld</div>
            <div class="check-item"><input type="checkbox" ${checkedAttr(record.reason_view_report && record.report_xray)}> X-Ray</div>
            <div class="check-item"><input type="checkbox" ${checkedAttr(record.reason_view_report && record.report_ct)}> CT</div>
            <div class="check-item"><input type="checkbox" ${checkedAttr(record.reason_view_report && record.report_usg)}> USG</div>
          </div>
          <div style="margin-top: 1px;">
            <div style="display: flex; align-items: flex-end;">
              <input type="checkbox" ${checkedAttr(record.reason_view_report && !!record.report_other)}>
              <div class="sub-text" style="text-align: left;">其他</div>
            </div>
            <div style="border-bottom: 1px solid black; width: 90%; margin-right: 5px;">
              <textarea rows="1">${escapeHtml(record.report_other ?? '')}</textarea>
            </div>
          </div>
        </div>
      </td>
      <td style="width: 150px; padding: 6px;">
        <div class="check-item"><input type="checkbox" ${checkedAttr(feeExempt)}> 合資格豁免收費</div>
        <textarea rows="7" style="margin-top: 8px;">${escapeHtml(remarksLines.join('；'))}</textarea>
      </td>
    </tr>
  `;
}

function buildPage(
  records: CgatRecord[],
  patientMap: Map<number, Patient>,
  visitDate: string,
  facilityName: string,
  pageNum: number,
  totalPages: number
): string {
  const sortedRecords = [...records].sort((a, b) => {
    const pa = patientMap.get(a.patient_id);
    const pb = patientMap.get(b.patient_id);
    return compareBed(pa?.床號 ?? '', pb?.床號 ?? '');
  });

  const rows = sortedRecords.map(r => buildRow(r, patientMap.get(r.patient_id))).join('');

  const cgasNew = records.filter(r => r.is_cgas && r.case_type === '新症').length;
  const cgasOld = records.filter(r => r.is_cgas && r.case_type === '舊症').length;
  const eolNew = records.filter(r => r.is_eol && r.case_type === '新症').length;
  const eolOld = records.filter(r => r.is_eol && r.case_type === '舊症').length;

  return `
<table class="print-wrapper">
  <thead class="page-header">
    <tr>
      <td>
        <div class="header-content">
          <div class="title-row">
            <div class="main-title">廣華醫院 社區老人評估服務 - 診症名單</div>
            <div class="contact-box">
              CGAS 傳真 : 2171 4825 &nbsp;&nbsp;&nbsp; CGAS 電話 : 3517 5026
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="width: 38%;">
                <div class="adaptive-line"><span>院舍名稱：</span><div class="input-box"><textarea rows="1">${escapeHtml(facilityName)}</textarea></div></div>
              </td>
              <td style="width: 23%;">
                <div class="adaptive-line"><span>院舍電話：</span><div class="input-box"><textarea rows="1"></textarea></div></div>
              </td>
              <td style="width: 39%; padding-left: 10px;">
                <div class="check-item">
                  <input type="checkbox"> CGAS Dr Visit &nbsp;&nbsp;&nbsp; <input type="checkbox"> CGAS Dr Tele-med
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2">
                <div class="adaptive-line">
                  <span>診症日期：</span>
                  <div class="input-box" style="width: 180px; flex:none;">
                    <textarea rows="1">${escapeHtml(visitDate)}</textarea>
                  </div>
                  <span style="margin-left:5px;">上午 / 下午 (星期</span>
                  <div class="input-box" style="width: 30px; flex:none;">
                    <textarea rows="1" style="text-align:center;">${escapeHtml(getWeekdayLabel(visitDate))}</textarea>
                  </div>
                  <span>)</span>
                </div>
              </td>
              <td style="padding-left: 10px;">
                <div class="check-item" style="font-size: 14px;">
                  CGAS 新症：<span style="display:inline-block; border-bottom: 0.5px solid black; width: 40px; margin: 0 4px; text-align:center; font-size:14px;">${cgasNew}</span>
                  舊症：<span style="display:inline-block; border-bottom: 0.5px solid black; width: 40px; margin: 0 4px; text-align:center; font-size:14px;">${cgasOld}</span> &nbsp;
                  EOL 新症：<span style="display:inline-block; border-bottom: 0.5px solid black; width: 40px; margin: 0 4px; text-align:center; font-size:14px;">${eolNew}</span>
                  舊症：<span style="display:inline-block; border-bottom: 0.5px solid black; width: 40px; margin: 0 4px; text-align:center; font-size:14px;">${eolOld}</span>
                </div>
              </td>
            </tr>
          </table>
        </div>
        <br>
        <table class="main-table">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">床號 No.</th>
              <th style="width: 280px; text-align: left; padding-left: 10px;">姓名： &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; * ID： xxx(x)</th>
              <th style="width: 85px;">新症</th>
              <th style="width: 70px;">舊症</th>
              <th style="width: 110px;">配藥</th>
              <th style="width: 45px;">出院</th>
              <th style="width: 45px;">簽信</th>
              <th style="width: 105px;">看報告</th>
              <th style="width: 150px; text-align: left; padding-left: 10px;">備註：</th>
            </tr>
          </thead>
        </table>
      </td>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td>
        <table class="main-table" style="border-top: none;">
          ${rows}
        </table>
      </td>
    </tr>
  </tbody>

  <tfoot class="page-footer">
    <tr>
      <td>
        <div class="footer-note">
          * 請填上身份證英文字母及首 3 個數字<br>
          ** 請在藥單右上角填上身份代號：<u>TPA</u>-綜援金/院舍券/OALA; <u>GOV</u>-公務員/家屬; <u>HAS</u>-醫管局員工/家屬; <u>WAIVE</u>-醫務社工豁免紙; 其他豁免-(請註明); <u>EP1</u>-自費
        </div>
        <div class="page-num-area">
          第 <span style="border-bottom: 0.5px solid black; width: 60px; display: inline-block; vertical-align: bottom;"><textarea rows="1" style="text-align:center;">${pageNum}</textarea></span> / ${totalPages} 頁
        </div>
      </td>
    </tr>
  </tfoot>
</table>
<div class="page-break"></div>
`;
}

export function generateCgatWorksheetHtml(
  records: CgatRecord[],
  patients: Patient[],
  facilityName: string
): string {
  const patientMap = new Map<number, Patient>();
  for (const p of patients) {
    patientMap.set(p.院友id, p);
  }

  // 按診症日期分組，每個日期一張；排除未知/無日期
  const grouped: Record<string, CgatRecord[]> = {};
  for (const r of records) {
    if (r.cgat_visit_unknown || !r.cgat_visit_date) continue;
    const d = r.cgat_visit_date;
    grouped[d] = grouped[d] || [];
    grouped[d].push(r);
  }

  const visitDates = Object.keys(grouped).sort();
  const totalPages = visitDates.length;

  const pages = visitDates.map((date, idx) =>
    buildPage(grouped[date], patientMap, date, facilityName, idx + 1, totalPages)
  );

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <title>廣華醫院社區老人評估服務-診症名單</title>
  <style>
    @page {
      size: A4;
      margin: 5mm 10mm 12mm 10mm;
    }
    body {
      font-family: "MingLiU", "PMingLiU", "Microsoft JhengHei", serif;
      font-size: 17px;
      line-height: 1.2;
      margin: 0;
      padding: 0;
      color: #000;
    }
    .print-wrapper {
      width: 100%;
      border-collapse: collapse;
    }
    .page-header { display: table-header-group; }
    .page-footer { display: table-footer-group; }
    .header-content { width: 100%; padding-bottom: 5px; }
    .title-row { display: flex; justify-content: space-between; align-items: center; }
    .main-title { font-size: 22px; font-weight: bold; }
    .contact-box { border: 1.5px solid black; padding: 4px 10px; font-size: 17px; }
    .adaptive-line { display: flex; align-items: flex-end; margin: 3px 0; }
    .adaptive-line span { white-space: nowrap; }
    .adaptive-line .input-box {
      flex: 1;
      border: none;
      border-bottom: 0.5px solid black;
      margin-left: 5px;
      height: 20px;
    }
    .main-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 17px;
    }
    .main-table th, .main-table td {
      border: 1px solid black;
      padding: 3px;
      vertical-align: top;
      word-break: break-all;
    }
    .main-table th {
      background-color: #f8f8f8;
      font-weight: normal;
      font-size: 17px;
      text-align: center;
      height: 35px;
    }
    .vertical-header {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      white-space: nowrap;
      height: 60px;
      vertical-align: middle;
    }
    .inner-flex { display: flex; flex-direction: column; height: 100%; justify-content: flex-start; }
    .check-item { display: flex; align-items: center; white-space: nowrap; margin-bottom: 3px; font-size: 17px; }
    .sub-text { font-size: 17px; text-align: center; width: 100%; margin-top: 2px; }
    textarea {
      width: 100%;
      border: none;
      resize: none;
      font-family: inherit;
      font-size: 17px;
      outline: none;
      background: transparent;
      padding: 0;
      display: block;
    }
    input[type="checkbox"] {
      transform: scale(1.3);
      margin: 0 6px 0 4px;
      vertical-align: middle;
    }
    .data-row { page-break-inside: avoid; break-inside: avoid; }
    .data-row td { height: 252px; }
    .footer-note { font-size: 12px; padding-top: 5px; line-height: 1.4; }
    .page-num-area { text-align: center; margin-top: 8px; font-size: 16px; position: relative; }
    .page-id { position: absolute; right: 0; bottom: 0; font-size: 11px; }
    .page-break { page-break-after: always; }
    .page-break:last-of-type { page-break-after: auto; }
  </style>
</head>
<body>

${pages.join('')}

</body>
</html>`;
}

function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = (): void => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow!;
  win.addEventListener('afterprint', () => setTimeout(cleanup, 200));

  const triggerPrint = (): void => {
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  };

  if (doc.readyState === 'complete') {
    triggerPrint();
  } else {
    win.addEventListener('load', triggerPrint);
  }

  window.setTimeout(cleanup, 60_000);
}

export async function printCgatWorksheet(
  records: CgatRecord[],
  patients: Patient[],
  selectedRecordIds: string[]
): Promise<void> {
  if (selectedRecordIds.length === 0) {
    alert('請先選擇要列印的 CGAT 記錄');
    return;
  }

  const selectedRecords = records.filter(r => selectedRecordIds.includes(r.id));
  const recordsWithDate = selectedRecords.filter(r => !r.cgat_visit_unknown && !!r.cgat_visit_date);

  if (recordsWithDate.length === 0) {
    alert('選擇的記錄沒有有效的 CGAT 到診日期');
    return;
  }

  const { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } = await import('./facilitySettings');
  const settings = await getFacilitySettings();
  const facilityName = settings.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;

  const html = generateCgatWorksheetHtml(recordsWithDate, patients, facilityName);
  printViaIframe(html);
}
