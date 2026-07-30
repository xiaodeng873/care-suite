import { formatDisplayDate, calculateAge } from './dateFormat';
import type {
  Patient,
  CarePlanWithDetails,
  CarePlanProblem,
  ProblemCategory,
  DiagnosisRecord,
} from '../lib/database';
import {
  getDiagnosisRecordsByPatientId,
  getPreviousCarePlanReviewDate,
} from '../lib/database';
import { getPrintBedNumber } from './bedTransferUtils';

/**
 * 個人照顧計劃 (ICP) A4 直向 HTML 列印產生器。
 */

const PRINT_FRAME_ID = 'icp-print-frame';

const escapeHtml = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/** 空白佔位，用於簽名欄等需要下劃線的位置。 */
const blankLine = (value: string | undefined | null): string => {
  const v = value ? String(value).trim() : '';
  return v || '<span class="blank-line">&nbsp;</span>';
};

/** 空白佔位，用於非簽名欄位，只顯示空間。 */
const blankSpace = (value: string | undefined | null): string => {
  const v = value ? String(value).trim() : '';
  return v || '&nbsp;';
};

const checkbox = (checked: boolean): string =>
  `<span class="checkbox ${checked ? 'checked' : ''}"></span>`;

const formatChineseName = (patient: Patient): string =>
  `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;

const formatEnglishName = (patient: Patient): string => {
  if (patient.英文姓氏 || patient.英文名字) {
    return `${patient.英文姓氏 || ''} ${patient.英文名字 || ''}`.trim();
  }
  return patient.英文姓名 || '';
};

const formatBedInfo = (patient: Patient): string => {
  const parts: string[] = [];
  const printBed = getPrintBedNumber(patient);
  if (patient.bed_id || printBed) {
    parts.push(printBed || patient.bed_id || '');
  }
  return parts.join(' / ') || '-';
};

const nursingNeedNames = [
  '失禁',
  '傷口',
  '壓瘡',
  '導尿管',
  '鼻胃管',
  '胃造瘻',
  '大腸造口',
  '氣管造口',
  '吸氧',
  '腹膜透析',
  '血液透析',
  '其他',
];

const professionalOrder: ProblemCategory[] = [
  '護理',
  '物理治療',
  '職業治療',
  '社工',
  '言語治療',
  '營養師',
  '醫生',
];

const professionalLabels: Record<ProblemCategory, string> = {
  護理: '護士/保健員',
  物理治療: '物理治療師',
  職業治療: '職業治療師',
  社工: '社工',
  言語治療: '言語治療師',
  營養師: '營養師',
  醫生: '醫生',
};

export interface CarePlanPrintInput {
  patient: Patient;
  carePlan: CarePlanWithDetails;
  facilityName?: string;
  diagnoses?: DiagnosisRecord[];
  previousReviewDate?: string | null;
}

/** 所有頁面共用的頁首：h1 院舍名稱 + h2 個人照顧計劃 + 院友基本資料表。 */
function generatePageHeader(patient: Patient, facilityName: string): string {
  const photoHtml = patient.院友相片
    ? `<img src="${escapeHtml(patient.院友相片)}" class="patient-photo" alt="院友相片" />`
    : `<div class="patient-photo-placeholder">無相片</div>`;

  return `
    <div class="page-header">
      <div class="header-title-section">
        <h1 class="header-h1">${escapeHtml(facilityName || '')}</h1>
        <h2 class="header-h2">個人照顧計劃</h2>
      </div>
      <table class="header-info-table">
        <tr>
          <td class="header-photo-cell" rowspan="2">
            <div class="header-photo">${photoHtml}</div>
          </td>
          <td class="label">中文姓名</td>
          <td>${escapeHtml(formatChineseName(patient))}</td>
          <td class="label">英文姓名</td>
          <td>${escapeHtml(formatEnglishName(patient))}</td>
          <td class="label">性別</td>
          <td>${escapeHtml(patient.性別 || '')}</td>
          <td class="label">年齡</td>
          <td>${patient.出生日期 ? `${calculateAge(patient.出生日期)} 歲` : blankSpace('')}</td>
        </tr>
        <tr>
          <td class="label">出生年月日</td>
          <td>${formatDisplayDate(patient.出生日期)}</td>
          <td class="label">身份證號碼</td>
          <td>${escapeHtml(patient.身份證號碼 || '')}</td>
          <td class="label">區域 / 床號</td>
          <td>${escapeHtml(formatBedInfo(patient))}</td>
          <td class="label">入住日期</td>
          <td>${formatDisplayDate(patient.入住日期)}</td>
        </tr>
      </table>
    </div>
  `;
}

function generateFooter(pageIndex: number, totalPages: number): string {
  return `
    <div class="page-footer">
      <span></span>
      <span>第 ${pageIndex} 頁 / 共 ${totalPages} 頁</span>
    </div>
  `;
}

function generateDiagnosisText(diagnoses?: DiagnosisRecord[]): string {
  if (!diagnoses || diagnoses.length === 0) {
    return blankSpace('');
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  diagnoses.forEach(d => {
    const item = d.diagnosis_item?.trim();
    if (item && !seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  });
  if (unique.length === 0) return blankSpace('');
  return escapeHtml(unique.join('、'));
}

function generateIndexPage(
  input: CarePlanPrintInput,
  categoryPages: { category: ProblemCategory; problems: CarePlanProblem[] }[],
  totalPages: number
): string {
  const { patient, carePlan, facilityName, previousReviewDate } = input;
  const facilityNameText = facilityName || '';

  const nursingNeeds = carePlan.nursing_needs || [];
  const overallNeed = nursingNeeds.find(n => n.item_name === '整體');
  const hasOverallNeed = overallNeed ? overallNeed.has_need : false;

  // 只顯示有提出問題的專業簽署欄
  const problemCategories = new Set(carePlan.problems?.map(p => p.problem_category) || []);

  // 計劃內容項目索引（專業 → 問題 → 頁碼）
  const indexContentRows = categoryPages
    .map(({ category, problems }, pageIndex) => {
      const startPage = pageIndex + 2;
      return problems
        .map((problem, problemIndex) => {
          const categoryCell = problemIndex === 0
            ? `<td rowspan="${problems.length}">${escapeHtml(professionalLabels[category])}</td>`
            : '';
          return `
            <tr>
              ${categoryCell}
              <td>${escapeHtml(problem.problem_description)}</td>
              <td style="text-align:center">${startPage}</td>
            </tr>
          `;
        })
        .join('');
    })
    .join('');

  const professionalRows = professionalOrder
    .filter(category => problemCategories.has(category))
    .map(category => {
      const p = (carePlan.case_conference_professionals || []).find(
        cp => cp.category === category
      );
      return `
        <tr>
          <td>${escapeHtml(professionalLabels[category])}</td>
          <td>${blankSpace(p?.assessor)}</td>
          <td></td>
          <td>${p ? formatDisplayDate(p.assessment_date) : blankSpace('')}</td>
          <td></td>
        </tr>
      `;
    }).join('');

  return `
    <div class="page index-page">
      ${generatePageHeader(patient, facilityNameText)}

      <div class="section-title">計劃周期</div>
      <table class="info-table compact">
        <tr>
          <td class="label">上次複檢日期</td>
          <td>${previousReviewDate ? formatDisplayDate(previousReviewDate) : '首次'}</td>
          <td class="label">是次複檢日期</td>
          <td>${formatDisplayDate(carePlan.plan_date)}</td>
          <td class="label">下次複檢日期</td>
          <td>${formatDisplayDate(carePlan.review_due_date)}</td>
        </tr>
      </table>

      <div class="section-title">體格檢驗</div>
      <table class="info-table compact">
        <tr>
          <td class="label">體重（公斤）</td>
          <td>${blankSpace('')}</td>
          <td class="label">身高（米）</td>
          <td>${blankSpace('')}</td>
          <td class="label">BMI</td>
          <td>${blankSpace('')}</td>
        </tr>
      </table>

      <div class="section-title">診斷</div>
      <div class="diagnosis-box">${generateDiagnosisText(input.diagnoses)}</div>

      <div class="section-title">藥物或食物過敏歷史</div>
      <div class="allergy-box">${blankSpace(patient.藥物敏感?.join('、') || 'NKDA')}</div>

      <div class="section-title">護理需要（可多選）</div>
      <div class="nursing-needs-overall compact">
        ${checkbox(hasOverallNeed)} 有　　${checkbox(!hasOverallNeed)} 沒有
      </div>
      <div class="nursing-needs-grid compact">
        ${nursingNeedNames.map(name => {
          const item = nursingNeeds.find(n => n.item_name === name);
          const has = item ? item.has_need : false;
          const remarks = item?.remarks ? `（${item.remarks}）` : '';
          return `<div class="need-item">${checkbox(has)} ${escapeHtml(name)}${escapeHtml(remarks)}</div>`;
        }).join('')}
      </div>

      <div class="section-title">計劃內容項目</div>
      <table class="info-table compact index-content-table">
        <thead>
          <tr>
            <th>專業類別</th>
            <th>問題</th>
            <th>頁碼</th>
          </tr>
        </thead>
        <tbody>
          ${indexContentRows || '<tr><td colspan="3" class="empty-cell">暫無</td></tr>'}
        </tbody>
      </table>

      <div class="section-title">評估職員簽署表</div>
      <table class="signature-table compact">
        <thead>
          <tr>
            <th>專業類別</th>
            <th>姓名</th>
            <th>簽署</th>
            <th>完成日期</th>
            <th>檢討日期</th>
          </tr>
        </thead>
        <tbody>
          ${professionalRows || '<tr><td colspan="5" class="empty-cell">暫無</td></tr>'}
        </tbody>
      </table>

      <div class="section-title">參與聲明</div>
      <div class="declaration compact">
        ${checkbox(carePlan.family_participated ?? false)} 邀請家人及院友參與個人護理計劃過程，徵詢意見。<br/>
        <span class="signature-line">（職員簽署）${blankLine('')}</span>
      </div>

      <div class="section-title">家屬聯絡</div>
      <table class="info-table compact">
        <tr>
          <td class="label">個案會議日期</td>
          <td>${formatDisplayDate(carePlan.case_conference_date)}</td>
          <td class="label">聯絡家屬 / 聽取報告日期</td>
          <td>${formatDisplayDate(carePlan.family_contact_date)}</td>
        </tr>
        <tr>
          <td class="label">院友家屬姓名及簽署</td>
          <td colspan="3">${blankLine(carePlan.family_member_name)}</td>
        </tr>
      </table>

      <div class="section-title">特別護理需求 / 其他專業意見（如有）</div>
      <div class="remarks-box compact">${blankSpace(carePlan.special_care_needs)}</div>

      <div class="disclaimer compact">
        院友家屬簽署後，即代表已閱覽後面各頁的個人照顧計劃，並清楚明白及同意計劃內容。
      </div>
      ${generateFooter(1, totalPages)}
    </div>
  `;
}

function generateProblemsForCategory(
  input: CarePlanPrintInput,
  category: ProblemCategory,
  problems: CarePlanProblem[],
  pageIndex: number,
  totalPages: number
): string {
  const { patient, facilityName } = input;

  const categoryRows = problems.map(problem => {
    const goals = problem.expected_goals || [];
    const interventions = problem.interventions || [];
    const outcomeOptions: Array<'保持現狀' | '滿意' | '部分滿意' | '需要持續改善'> = ['保持現狀', '滿意', '部分滿意', '需要持續改善'];

    return `
      <tr>
        <td class="category-cell" colspan="4">${escapeHtml(problem.problem_category)}</td>
      </tr>
      <tr>
        <td>
          <div class="problem-text">${escapeHtml(problem.problem_description)}</div>
          <div class="assessor-line">評估職員：${blankSpace(problem.problem_assessor)}</div>
        </td>
        <td>
          <ul class="item-list">
            ${goals.length > 0
              ? goals.map(g => `<li>${escapeHtml(g)}</li>`).join('')
              : '<li class="empty">—</li>'}
          </ul>
        </td>
        <td>
          <ul class="item-list">
            ${interventions.length > 0
              ? interventions.map(i => `<li>${escapeHtml(i)}</li>`).join('')
              : '<li class="empty">—</li>'}
          </ul>
        </td>
        <td>
          <div class="outcome-options">
            ${outcomeOptions.map(o => `
              <div class="outcome-option">
                ${checkbox(problem.outcome_review === o)} ${escapeHtml(o)}
              </div>
            `).join('')}
          </div>
        </td>
      </tr>
      <tr>
        <td class="notes-label" colspan="4">其他要點 / 備註（如在成效檢討部分選擇「部分滿意」或「需要持續改善」時填寫）</td>
      </tr>
      <tr>
        <td class="notes-cell" colspan="4">${blankSpace(problem.outcome_review_details)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="page problem-page">
      ${generatePageHeader(patient, facilityName || '')}
      <table class="problem-table">
        <thead>
          <tr>
            <th class="col-problem">問題</th>
            <th class="col-goals">護理 / 介入目標</th>
            <th class="col-interventions">護理計劃 / 介入步驟</th>
            <th class="col-outcome">成效檢討</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRows}
        </tbody>
      </table>
      ${generateFooter(pageIndex, totalPages)}
    </div>
  `;
}

function generateFullHtml(input: CarePlanPrintInput): string {
  const { patient, carePlan } = input;

  // 按專業分頁
  const problemsByCategory = new Map<ProblemCategory, CarePlanProblem[]>();
  (carePlan.problems || [])
    .sort((a, b) => a.display_order - b.display_order)
    .forEach(problem => {
      const list = problemsByCategory.get(problem.problem_category) || [];
      list.push(problem);
      problemsByCategory.set(problem.problem_category, list);
    });

  const categoryPages = professionalOrder
    .filter(category => problemsByCategory.has(category))
    .map(category => ({
      category,
      problems: problemsByCategory.get(category) || [],
    }));

  const totalPages = 1 + categoryPages.length;

  const pages: string[] = [];
  pages.push(generateIndexPage(input, categoryPages, totalPages));
  categoryPages.forEach((entry, index) => {
    pages.push(generateProblemsForCategory(input, entry.category, entry.problems, index + 2, totalPages));
  });

  const patientName = escapeHtml(formatChineseName(patient));
  const facilityName = escapeHtml(input.facilityName || '');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8" />
  <title>個人照顧計劃 - ${patientName}</title>
  <style>
    @page icp {
      size: A4 portrait;
      margin: 12mm 10mm 10mm 10mm;
    }

    * { box-sizing: border-box; }

    body {
      font-family: "Microsoft JhengHei", "PingFang HK", "Heiti TC", sans-serif;
      font-size: 9pt;
      line-height: 1.25;
      color: #000;
      margin: 0;
      padding: 0;
    }

    .icp-print { page: icp; }

        .page {
      page: icp;
      page-break-after: always;
      break-after: page;
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 275mm;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }

    .page-header {
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      margin-bottom: 3px;
    }
    .header-title-section {
      text-align: center;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
      margin-bottom: 2px;
    }
    .header-h1 {
      font-size: 22pt;
      font-weight: bold;
      margin: 0;
      line-height: 1.1;
    }
    .header-h2 {
      font-size: 18pt;
      font-weight: bold;
      margin: 0;
      line-height: 1.1;
    }
    .header-info-table {
      width: 100%;
      border-collapse: collapse;
    }
    .header-info-table td,
    .header-info-table th {
      border: 1px solid #000;
      padding: 1px 3px;
      vertical-align: middle;
      text-align: left;
    }
    .header-info-table td.label {
      white-space: nowrap;
      width: 1%;
    }
    .header-photo-cell {
      width: 56px;
      min-width: 56px;
      text-align: center;
      vertical-align: middle;
    }
    .header-photo {
      width: 40px;
      height: 50px;
      border: 1px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7pt;
      color: #666;
      margin: 0 auto;
      background: #fff;
    }
    .patient-photo {
      width: 40px;
      height: 50px;
      object-fit: cover;
      border: 1px solid #000;
      display: block;
      margin: 0 auto;
    }
    .patient-photo-placeholder {
      width: 40px;
      height: 50px;
      border: 1px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7pt;
      color: #666;
      margin: 0 auto;
      background: #fff;
    }

    .page-footer {
      display: flex;
      justify-content: flex-end;
      font-size: 8pt;
      border-top: 1px solid #000;
      padding-top: 2px;
      margin-top: auto;
    }

    .section-title {
      font-weight: bold;
      font-size: 10pt;
      margin-top: 3px;
      margin-bottom: 0;
      border-left: 3px solid #000;
      padding-left: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 3px;
    }
    td, th {
      border: 1px solid #000;
      padding: 1px 4px;
      vertical-align: top;
    }
    th { background: #f0f0f0; text-align: center; }
    td.label {
      background: #f8f8f8;
      font-weight: bold;
      white-space: nowrap;
      width: 1%;
    }

    .info-table td { text-align: left; }
    .info-table.compact td,
    .info-table.compact th { padding: 0px 3px; }

    .diagnosis-box,
    .allergy-box {
      border: 1px solid #000;
      min-height: 14px;
      padding: 1px 3px;
      margin-bottom: 2px;
    }

    .declaration {
      border: 1px solid #000;
      padding: 2px 3px;
      margin-bottom: 2px;
    }
    .declaration.compact { padding: 1px 3px; }
    .signature-line {
      display: block;
      margin-top: 2px;
    }

    .nursing-needs-overall {
      border: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 1px 3px;
    }
    .nursing-needs-overall.compact { padding: 1px 3px; }
    .nursing-needs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid #000;
      border-top: none;
    }
    .nursing-needs-grid.compact .need-item { padding: 0px 3px; }
    .need-item {
      padding: 1px 3px;
      border-top: 1px solid #000;
      border-right: 1px solid #000;
    }
    .need-item:nth-child(-n+3) { border-top: none; }
    .need-item:nth-child(3n) { border-right: none; }

    .signature-table th,
    .signature-table td { text-align: center; }
    .signature-table td:first-child { text-align: left; }
    .signature-table.compact td,
    .signature-table.compact th { padding: 0px 3px; }
    .empty-cell { text-align: center; color: #666; }

    .index-content-table th,
    .index-content-table td:last-child { text-align: center; }
    .index-content-table td:first-child { text-align: left; }

    .remarks-box {
      border: 1px solid #000;
      min-height: 16px;
      padding: 1px 3px;
      margin-bottom: 2px;
    }
    .remarks-box.compact { min-height: 14px; padding: 1px 3px; }

    .disclaimer {
      border: 1px solid #000;
      padding: 1px 3px;
      font-size: 8pt;
      margin-top: 2px;
    }
    .disclaimer.compact { padding: 1px 3px; margin-top: 2px; }

    .problem-table { margin-top: 3px; }
    .problem-table th { font-size: 9pt; }
    .col-problem { width: 25%; }
    .col-goals { width: 25%; }
    .col-interventions { width: 35%; }
    .col-outcome { width: 15%; }
    .category-cell {
      background: #e6e6e6;
      font-weight: bold;
      text-align: left;
    }
    .problem-text { font-weight: bold; margin-bottom: 3px; }
    .assessor-line {
      font-size: 8pt;
      margin-top: 3px;
    }
    .item-list {
      margin: 0;
      padding-left: 14px;
    }
    .item-list li { margin-bottom: 1px; }
    .item-list li.empty { list-style: none; color: #666; }
    .outcome-options { margin-bottom: 3px; }
    .outcome-option { margin-bottom: 1px; }
    .notes-label {
      font-weight: bold;
      background: #f8f8f8;
    }
    .notes-cell { min-height: 22px; }

    .checkbox {
      display: inline-block;
      width: 9px;
      height: 9px;
      border: 1px solid #000;
      margin-right: 3px;
      vertical-align: middle;
    }
    .checkbox.checked {
      background: #000;
      box-shadow: inset 0 0 0 1px #fff;
    }
    .blank-line {
      display: inline-block;
      min-width: 120px;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
      color: #999;
    }
  </style>
</head>
<body class="icp-print">
  ${pages.join('')}
</body>
</html>`;
}

/**
 * 取得列印用的 HTML 字串（供測試 / 預覽）。
 */
export function getCarePlanPrintHtml(input: CarePlanPrintInput): string {
  return generateFullHtml(input);
}

/**
 * 列印個人照顧計劃。
 */
export async function printCarePlan(
  input: Omit<CarePlanPrintInput, 'facilityName' | 'diagnoses' | 'previousReviewDate'>
): Promise<void> {
  const [facilitySettings, diagnoses, previousReviewDate] = await Promise.all([
    getFacilitySettings(),
    getDiagnosisRecordsByPatientId(input.patient.院友id),
    getPreviousCarePlanReviewDate(input.carePlan.id),
  ]);

  const fullInput: CarePlanPrintInput = {
    ...input,
    facilityName: facilitySettings.facilityNameZh,
    diagnoses,
    previousReviewDate,
  };

  const html = generateFullHtml(fullInput);

  const iframe = document.createElement('iframe');
  iframe.id = PRINT_FRAME_ID;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('無法建立 iframe 文件');
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  iframe.contentWindow?.addEventListener('afterprint', () => {
    iframe.remove();
  });
}

/**
 * 非同步包裝：直接從 planId 取得完整資料後列印。
 */
export async function printCarePlanById(
  patient: Patient,
  planId: string,
  getCarePlanWithDetails: (id: string) => Promise<CarePlanWithDetails | null>
): Promise<void> {
  const carePlan = await getCarePlanWithDetails(planId);
  if (!carePlan) {
    console.error('找不到照顧計劃:', planId);
    alert('找不到照顧計劃');
    return;
  }
  await printCarePlan({ patient, carePlan });
}
