import { IncidentReport, Patient } from '../lib/database';
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';

import { formatDisplayDate } from './dateFormat';
import { getPrintBedNumber } from './bedTransferUtils';

function formatTime(value: string | undefined | null): string {
  if (!value) return '';
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// 生成意外經過摘要 (不含日期、時間、院友名，因其他欄位已有)
const generateIncidentSummary = (patient: Patient, report: IncidentReport): string => {
  let summary = '';

  // 位置
  const location = report.location === '其他' ? (report.other_location || '其他') : (report.location || '');
  const activity = report.patient_activity === '其他' ? (report.other_patient_activity || '其他') : (report.patient_activity || '');
  if (location || activity) {
    summary += `在${location}${activity}時`;
  }

  // 身體不適
  const discomfortReasons = report.physical_discomfort
    ? Object.entries(report.physical_discomfort)
        .filter(([key, val]) => val === true && key !== '不適用')
        .map(([key]) => key)
    : [];
  if (discomfortReasons.length > 0) {
    summary += `，${discomfortReasons.join('、')}`;
  }

  // 不安全行為
  const unsafeBehaviors = report.unsafe_behavior
    ? Object.entries(report.unsafe_behavior)
        .filter(([key, val]) => val === true && key !== '不適用')
        .map(([key]) => key === '其他' ? (report.unsafe_behavior['其他說明'] || '其他') : key)
    : [];
  if (unsafeBehaviors.length > 0) {
    summary += `及${unsafeBehaviors.join('、')}`;
  }

  // 環境因素
  const envFactors = report.environmental_factors
    ? Object.entries(report.environmental_factors)
        .filter(([key, val]) => val === true && key !== '不適用')
        .map(([key]) => key === '其他' ? (report.environmental_factors['其他說明'] || '其他') : key)
    : [];
  if (envFactors.length > 0) {
    summary += `，環境中存在${envFactors.join('、')}`;
  }

  // 事故性質
  if (report.incident_type) {
    summary += `，導致${report.incident_type}${report.other_incident_type ? '（' + report.other_incident_type + '）' : ''}`;
  }

  // 目擊者/發現者（若未填寫名字則不顯示）
  if (report.witness_found_by?.type && report.witness_found_by?.details) {
    const typeAction = report.witness_found_by.type === 'witness' ? '目擊' : '發現';
    summary += `，由${report.witness_found_by.details}${typeAction}`;
  }

  // 著地部位
  if (report.injury_location) {
    summary += `，${report.injury_location}著地`;
  }

  // 結尾：只有真正組合出內容時才補上句號
  if (summary) {
    summary += '。';
  }

  return summary;
};

// 按患者分組報告
interface GroupedReports {
  [patientId: number]: IncidentReport[];
}

// HTML 轉義函數
function escapeHtml(text: string): string {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export const generateIncidentReportPrintHTML = (
  reports: Array<{ patient: Patient; report: IncidentReport }>,
  facilityName: string
): string => {
  // 按患者分組
  const grouped: GroupedReports = {};
  reports.forEach(({ patient, report }) => {
    if (!grouped[patient.院友id]) {
      grouped[patient.院友id] = [];
    }
    grouped[patient.院友id].push(report);
  });

  // 生成每個患者的頁面
  const pages: string[] = [];

  Object.entries(grouped).forEach(([_patientIdStr, patientReports]) => {
    // 取得該患者
    const patient = reports.find(r => r.patient.院友id === parseInt(_patientIdStr))?.patient;
    if (!patient) return;

    const patientName = patient.中文姓名 || '';
    const bedNumber = getPrintBedNumber(patient);
    const gender = patient.性別 || '';
    const age = patient.出生日期 
      ? new Date().getFullYear() - new Date(patient.出生日期).getFullYear() 
      : '';

    // 生成表格行
    const generateTableRows = (): string => {
      const rows: string[] = [];
      const minRows = Math.max(15, patientReports.length);

      for (let i = 0; i < minRows; i++) {
        const report = patientReports[i];

        // 判斷是否為真正的意外報告（而非空白頁的佔位）
        const hasData = report && (report.incident_date || report.incident_time || report.location || report.patient_activity || report.incident_type || report.injury_location || report.medical_arrangement || report.reporter_signature);

        if (hasData) {
          // 格式化日期和時間
          const incidentDate = report.incident_date
            ? formatDisplayDate(report.incident_date)
            : '';
          const incidentTime = formatTime(report.incident_time);

          // 事件欄：使用意外經過摘要
          const eventSummary = generateIncidentSummary(patient, report);

          // 傷勢及治療：合併 injury_situation + patient_complaint + immediate_treatment
          const injurySituation = report.injury_situation
            ? (typeof report.injury_situation === 'object'
                ? Object.entries(report.injury_situation)
                    .filter(([_, v]) => v === true)
                    .map(([k]) => k)
                    .join('、')
                : report.injury_situation)
            : '';
          const patientComplaint = report.patient_complaint || '';
          const immediateTreatment = report.immediate_treatment
            ? (typeof report.immediate_treatment === 'object'
                ? Object.entries(report.immediate_treatment)
                    .filter(([_, v]) => v === true)
                    .map(([k]) => k)
                    .join('、')
                : report.immediate_treatment)
            : '';
          const treatmentText = [injurySituation, patientComplaint, immediateTreatment]
            .filter(t => t)
            .join('\n');

          // 送院：☑ 表示已送院，☒ 表示未送院
          const hospitalised = report.medical_arrangement
            ? report.medical_arrangement.includes('急症室') || report.medical_arrangement.includes('門診')
            : false;
          const hospitalisedChecked = hospitalised ? '☑' : '☒';

          // 簽署：填報人姓名和職位
          const signature = [report.reporter_signature, report.reporter_position]
            .filter(s => s)
            .join('\n');

          rows.push(`
            <tr>
              <td class="col-no">${i + 1}</td>
              <td><input type="text" class="db-text-cell" value="${escapeHtml(incidentDate)}" readonly></td>
              <td><input type="text" class="db-text-cell" value="${escapeHtml(incidentTime)}" readonly></td>
              <td><div class="db-text-cell">${escapeHtml(eventSummary)}</div></td>
              <td><div class="db-text-cell">${escapeHtml(treatmentText)}</div></td>
              <td><div style="text-align: center; line-height: 1.5;">${hospitalisedChecked}</div></td>
              <td><div class="db-text-cell">${escapeHtml(signature)}</div></td>
            </tr>
          `);
        } else {
          // 空行（包括空白頁佔位或資料不完整的報告）
          rows.push(`
            <tr>
              <td class="col-no">${i + 1}</td>
              <td><input type="text" class="db-text-cell"></td>
              <td><input type="text" class="db-text-cell"></td>
              <td><div class="db-text-cell"></div></td>
              <td><div class="db-text-cell"></div></td>
              <td></td>
              <td><div class="db-text-cell"></div></td>
            </tr>
          `);
        }
      }

      return rows.join('');
    };

    const page = `
      <div class="page">
        <!-- 標頭 -->
        <div class="header-section">
          <div class="title-box">
            <h1>${escapeHtml(facilityName)}</h1>
            <h2>個人意外事件記錄表</h2>
          </div>
        </div>

        <!-- 院友基本資料 -->
        <div class="info-bar">
          <span>院友姓名：<input type="text" class="db-line-input" value="${escapeHtml(patientName)}" readonly style="width: 180px;"></span>
          <span>床號：<input type="text" class="db-line-input" value="${escapeHtml(bedNumber)}" readonly style="width: 100px;"></span>
          <span>性別：<input type="text" class="db-line-input" value="${escapeHtml(gender)}" readonly style="width: 80px;"></span>
          <span>年齡：<input type="text" class="db-line-input" value="${age}" readonly style="width: 80px;"></span>
        </div>

        <!-- 主表格 -->
        <table>
          <thead>
            <tr>
              <th class="col-no"></th>
              <th class="col-date">日期</th>
              <th class="col-time">時間</th>
              <th class="col-evt">事件</th>
              <th class="col-treat">傷勢及治療</th>
              <th class="col-hosp">
                <div class="hosp-header-box">
                  <span>送院</span>
                  <span>☑ ☒</span>
                </div>
              </th>
              <th class="col-sign">簽署</th>
            </tr>
          </thead>
          <tbody>
            ${generateTableRows()}
          </tbody>
        </table>

        <!-- 頁尾 -->
        <div class="footer">
          <div class="page-num">12</div>
          <div class="doc-code">A11D FK (11.2020)</div>
        </div>
      </div>
    `;

    pages.push(page);
  });

  const html = `
<!DOCTYPE html>
<html lang="zh-HK">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>個人意外事件記錄表 - 批量列印</title>
    <style>
        @page {
            size: 210mm 297mm;
            margin: 0;
        }

        @media print {
            html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                background: white;
            }
            .page {
                page-break-after: always;
                break-after: page;
                padding: 8mm;
            }
        }

        @media screen {
            body {
                background-color: #c8ccd0;
                padding: 10mm;
                margin: 0;
            }
            .page {
                background: white;
                box-shadow: 0 6px 24px rgba(0,0,0,0.22);
                margin: 0 auto 20px;
                min-height: 297mm;
            }
        }

        body {
            font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
            margin: 0;
            padding: 0;
            color: #000;
        }

        .page {
            width: 100%;
            box-sizing: border-box;
            padding: 8mm;
            display: flex;
            flex-direction: column;
        }

        /* 頂部標題區 */
        .header-section {
            display: flex;
            align-items: flex-start;
            margin-bottom: 5px;
            position: relative;
            justify-content: center;
        }

        .station-box { display: none; }

        .title-box {
            flex-grow: 1;
            text-align: center;
        }

        .title-box h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
        .title-box h2 { margin: 4px 0 0 0; font-size: 22px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }

        /* 院友資訊列 */
        .info-bar {
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
            white-space: nowrap;
        }

        .info-bar span {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .db-line-input {
            border: none;
            border-bottom: 1px solid black;
            background: transparent;
            font-family: inherit;
            padding: 0 5px;
            font-size: 15px;
        }

        /* 表格設定 */
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            border: 1.5px solid black;
        }

        th, td {
            border: 1px solid black;
            text-align: center;
            vertical-align: middle;
            padding: 0;
            height: 52px;
            overflow: visible;
            position: relative;
        }

        th {
            background-color: #fff;
            font-size: 16px;
            height: 40px;
        }

        /* 欄位寬度分配 */
        .col-no   { width: 40px; font-weight: bold; font-size: 16px; }
        .col-date { width: 100px; }
        .col-time { width: 80px; }
        .col-evt  { width: 210px; }
        .col-treat { width: 95px; }
        .col-hosp { width: 50px; font-size: 13px; line-height: 1.2; }
        .col-sign { width: 65px; }

        /* DB組件 */
        .db-text-cell {
            width: 100%;
            min-height: 100%;
            border: none;
            background: transparent;
            font-family: inherit;
            font-size: 14px;
            text-align: left;
            outline: none;
            box-sizing: border-box;
            padding: 2px;
            white-space: pre-wrap;
            word-break: break-word;
            overflow: visible;
            position: relative;
            z-index: 1;
        }

        .hosp-header-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            font-size: 12px;
        }

        /* 頁尾 */
        .footer {
            margin-top: auto;
            display: flex;
            justify-content: flex-end;
            position: relative;
            height: 30px;
        }

        .page-num {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            font-size: 24px;
            font-weight: bold;
            bottom: 0;
        }

        .doc-code {
            font-size: 11px;
            font-weight: bold;
            align-self: flex-end;
        }
    </style>
</head>
<body>
    ${pages.join('\n')}
</body>
</html>
  `;

  return html;
};

export const printIncidentReport = async (
  reports: Array<{ patient: Patient; report: IncidentReport }>
): Promise<void> => {
  if (reports.length === 0) {
    alert('沒有選擇要列印的記錄');
    return;
  }

  const settings = await getFacilitySettings();
  const facilityName = settings.facilityNameZh;
  const html = generateIncidentReportPrintHTML(reports, facilityName);

  // 使用隱藏的 iframe 進行列印，不開新視窗
  const old = document.getElementById('incident-report-print-iframe');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'incident-report-print-iframe';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 500);
};
