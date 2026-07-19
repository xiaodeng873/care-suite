import type { HealthAssessment } from '../lib/database';
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';

interface PatientInfo {
  床號?: string;
  中文姓名?: string;
  英文姓名?: string;
  性別?: string;
  出生日期?: string;
  身份證號碼?: string;
  入住日期?: string;
  護理等級?: string;
}

const escapeHtml = (str: string | undefined | null): string => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

/** Parse a TEXT column that may contain a JSON array, '、'-delimited string, or already be an array */
function parseTextToArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch { /* fall through */ }
    }
    return trimmed.split('、').filter(Boolean);
  }
  return [];
}

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('zh-TW');
  } catch {
    return dateStr;
  }
};

const formatArray = (arr: any): string => {
  if (!arr) return '-';
  if (Array.isArray(arr)) return arr.length > 0 ? arr.join('、') : '-';
  if (typeof arr === 'string') return arr || '-';
  return '-';
};

const abilityCell = (level: string | undefined, aid: string | undefined): string => {
  if (!level) return '<td>-</td><td>-</td>';
  const cls = level === '獨立' ? 'lv-ind' : '';
  const aidText = (level === '需要幫助' || level === '完全依賴') && aid ? aid : '';
  return `<td><span class="${cls}">${escapeHtml(level)}</span></td><td>${escapeHtml(aidText)}</td>`;
};

const visionCell = (level: string | undefined, aid: string | undefined, other: string | undefined): string => {
  if (!level) return '-';
  let result = escapeHtml(level);
  if (level === '需要輔助器' && aid) result += `（${escapeHtml(aid)}）`;
  if (level === '其他' && other) result += `（${escapeHtml(other)}）`;
  return result;
};

export const generateHealthAssessmentHtml = (
  assessment: HealthAssessment,
  patient: PatientInfo,
  facilityName: string
): string => {
  const da = assessment.daily_activities || {};
  const nd = assessment.nutrition_diet || {};
  const vh = assessment.vision_hearing || {};
  const bb = assessment.bowel_bladder_control || {};

  const commText = (() => {
    const c = assessment.communication_ability;
    if (!c) return '-';
    if (c === '其他' && assessment.communication_other) return `其他（${escapeHtml(assessment.communication_other)}）`;
    return escapeHtml(c);
  })();

  const consciousnessText = (() => {
    const items: string[] = parseTextToArray(assessment.consciousness_cognition);
    if (items.length === 0) return '-';
    const parts = items.map((i: string) => escapeHtml(i));
    if (items.includes('其他') && assessment.consciousness_other) {
      return parts.join('、') + `（${escapeHtml(assessment.consciousness_other)}）`;
    }
    return parts.join('、');
  })();

  const emotionalText = (() => {
    const items: string[] = parseTextToArray(assessment.emotional_expression);
    if (items.length === 0) return '-';
    const parts = items.map((i: string) => escapeHtml(i));
    if (items.includes('其他') && assessment.emotional_other) {
      return parts.join('、') + `（${escapeHtml(assessment.emotional_other)}）`;
    }
    return parts.join('、');
  })();

  const behaviorText = (() => {
    const items: string[] = parseTextToArray(assessment.behavior_expression);
    return items.length > 0 ? items.map((i: string) => escapeHtml(i)).join('、') : '-';
  })();

  const treatmentText = formatArray(assessment.treatment_items);

  const bowelText = (() => {
    if (!bb.bowel) return '-';
    let t = escapeHtml(bb.bowel);
    if (bb.bowel === '需要輔助器' && bb.bowel_aid) t += `（${escapeHtml(bb.bowel_aid)}）`;
    return t;
  })();

  const bladderText = (() => {
    if (!bb.bladder) return '-';
    let t = escapeHtml(bb.bladder);
    if (bb.bladder === '需要輔助器' && bb.bladder_aid) t += `（${escapeHtml(bb.bladder_aid)}）`;
    return t;
  })();

  const dietText = (() => {
    let parts: string[] = [];
    if (nd.condition) parts.push(`狀況: ${escapeHtml(nd.condition)}`);
    if (nd.meal_type) {
      let mt = escapeHtml(nd.meal_type);
      if (nd.meal_type === '特別' && nd.special_diet) mt += `（${escapeHtml(nd.special_diet)}）`;
      parts.push(`飯餐: ${mt}`);
    }
    return parts.length > 0 ? parts.join('　') : '-';
  })();

  // 吸煙 / 飲酒習慣
  const smokingText = escapeHtml(assessment.smoking_habit) || '-';
  const drinkingText = escapeHtml(assessment.drinking_habit) || '-';

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>健康評估記錄 - ${escapeHtml(patient.中文姓名)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 8mm 8mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", "Heiti TC", sans-serif;
      font-size: 9.5pt;
      color: #000;
      line-height: 1.3;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 194mm;
      margin: 0 auto;
      padding: 0;
      page-break-after: always;
    }
    .page:last-child { page-break-after: avoid; }

    /* ── 頁首 ── */
    .header {
      text-align: center;
      padding-bottom: 4px;
      margin-bottom: 5px;
      border-bottom: 2px solid #000;
    }
    .header .facility {
      font-size: 11pt;
      font-weight: bold;
      letter-spacing: 2px;
    }
    .header .title {
      font-size: 15pt;
      font-weight: bold;
      letter-spacing: 6px;
      margin-top: 2px;
    }

    /* ── 院友資料列 ── */
    .info-row {
      display: flex;
      flex-wrap: wrap;
      border: 1px solid #000;
      margin-bottom: 5px;
    }
    .info-row .cell {
      flex: 1 1 33.33%;
      padding: 2px 6px;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      font-size: 9pt;
    }
    .info-row .cell:nth-child(3n) { border-right: none; }
    .info-row .cell:nth-last-child(-n+3) { border-bottom: none; }
    .info-row .cell b { margin-right: 3px; }

    /* ── 區段標題 ── */
    .section { margin-bottom: 3px; }
    .section-title {
      background: #000;
      color: #fff;
      padding: 1.5px 8px;
      font-size: 9.5pt;
      font-weight: bold;
      margin-bottom: 0;
      border: 1px solid #000;
    }
    .section-title + table tr:first-child th,
    .section-title + table tr:first-child td {
      border-top: none;
    }

    /* ── 表格 ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      table-layout: fixed;
    }
    table th, table td {
      border: 1px solid #000;
      padding: 2px 5px;
      text-align: left;
      vertical-align: middle;
      word-wrap: break-word;
    }
    table th {
      background: #f0f0f0;
      font-weight: bold;
      white-space: nowrap;
    }

    /* 兩欄佈局 */
    .two-col th { width: 12%; }
    .two-col td { width: 38%; }

    /* ADL 表格 */
    .adl-table th:first-child { width: 70px; }
    .adl-table th:nth-child(2) { width: 75px; }

    /* 能力標記 */

    /* ── 備註 ── */
    .remarks-box {
      border: 1px solid #000;
      border-top: none;
      padding: 3px 6px;
      min-height: 28px;
      font-size: 9pt;
    }

    /* ── 頁尾 ── */
    .footer {
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1px solid #000;
      font-size: 7.5pt;
      display: flex;
      justify-content: space-between;
    }

    /* ── 簽署列 ── */
    .sign-row {
      display: flex;
      margin-top: 6px;
      gap: 20px;
    }
    .sign-row .sign-box {
      flex: 1;
      border-bottom: 1px solid #000;
      padding: 2px 0;
      font-size: 9pt;
      min-height: 22px;
    }
    .sign-row .sign-box span { font-weight: bold; }

    @media print {
      body { margin: 0; background: #fff; }
      .page { margin: 0 auto; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- ===== 頁首 ===== -->
    <div class="header">
      <div class="facility">${escapeHtml(facilityName)}</div>
      <div class="title">健康評估記錄</div>
    </div>

    <!-- ===== 院友基本資料 ===== -->
    <div class="info-row">
      <div class="cell"><b>床號:</b>${escapeHtml(patient.床號)}</div>
      <div class="cell"><b>姓名:</b>${escapeHtml(patient.中文姓名)}</div>
      <div class="cell"><b>性別:</b>${escapeHtml(patient.性別)}</div>
      <div class="cell"><b>出生日期:</b>${formatDate(patient.出生日期)}</div>
      <div class="cell"><b>入住日期:</b>${formatDate(patient.入住日期)}</div>
      <div class="cell"><b>護理等級:</b>${escapeHtml(patient.護理等級) || '-'}</div>
      <div class="cell"><b>評估日期:</b>${formatDate(assessment.assessment_date)}</div>
      <div class="cell"><b>評估人員:</b>${escapeHtml(assessment.assessor) || '-'}</div>
      <div class="cell"><b>下次到期:</b>${formatDate(assessment.next_due_date)}</div>
    </div>

    <!-- ===== 1. 吸煙習慣 / 2. 飲酒習慣 ===== -->
    <div class="section">
      <div class="section-title">1-2. 吸煙及飲酒習慣</div>
      <table class="two-col">
        <tr>
          <th>1. 吸煙</th>
          <td>${smokingText}</td>
          <th>2. 飲酒</th>
          <td>${drinkingText}</td>
        </tr>
      </table>
    </div>

    <!-- ===== 3. 日常活動及自理能力 ===== -->
    <div class="section">
      <div class="section-title">3. 日常活動及自理能力</div>
      <table style="margin-bottom:0;">
        <colgroup>
          <col style="width:90px;">
          <col style="width:50px;">
          <col>
        </colgroup>
        <tr>
          <th>肢體活動</th>
          <th>側</th>
          <th>狀況</th>
        </tr>
        <tr>
          <th rowspan="2">a. 肢體活動</th>
          <td>左側</td>
          <td>${formatArray(da.limb_movement_left)}</td>
        </tr>
        <tr>
          <td>右側</td>
          <td>${formatArray(da.limb_movement_right)}</td>
        </tr>
      </table>
      <table class="adl-table">
        <thead>
          <tr>
            <th>項目</th>
            <th>能力等級</th>
            <th>輔助器 / 說明</th>
          </tr>
        </thead>
        <tbody>
          <tr><th>b. 飲食</th>${abilityCell(da.eating, da.eating_aid)}</tr>
          <tr><th>c. 穿衣</th>${abilityCell(da.dressing, da.dressing_aid)}</tr>
          <tr><th>d. 梳洗</th>${abilityCell(da.grooming, da.grooming_aid)}</tr>
          <tr><th>e. 步行</th>${abilityCell(da.walking, da.walking_aid)}</tr>
          <tr><th>f. 上落床</th>${abilityCell(da.bed_transfer, da.bed_transfer_aid)}</tr>
          <tr><th>g. 沐浴</th>${abilityCell(da.bathing, da.bathing_aid)}</tr>
          <tr><th>h. 如廁</th>${abilityCell(da.toileting, da.toileting_aid)}</tr>
        </tbody>
      </table>
    </div>

    <!-- ===== 4. 飲食營養 ===== -->
    <div class="section">
      <div class="section-title">4. 飲食營養</div>
      <table class="two-col">
        <tr>
          <th>a. 狀況</th>
          <td>${escapeHtml(nd.condition) || '-'}</td>
          <th>b. 飯餐</th>
          <td>${escapeHtml(nd.meal_type) || '-'}${nd.meal_type === '特別' && nd.special_diet ? `（${escapeHtml(nd.special_diet)}）` : ''}</td>
        </tr>
      </table>
    </div>

    <!-- ===== 5. 視聽能力 ===== -->
    <div class="section">
      <div class="section-title">5. 視聽能力</div>
      <table class="two-col">
        <tr>
          <th>a. 左眼</th>
          <td>${visionCell(vh.left_eye, vh.left_eye_aid, vh.left_eye_other)}</td>
          <th>b. 右眼</th>
          <td>${visionCell(vh.right_eye, vh.right_eye_aid, vh.right_eye_other)}</td>
        </tr>
        <tr>
          <th>c. 左耳</th>
          <td>${visionCell(vh.left_ear, undefined, vh.left_ear_other)}</td>
          <th>d. 右耳</th>
          <td>${visionCell(vh.right_ear, undefined, vh.right_ear_other)}</td>
        </tr>
      </table>
    </div>

    <!-- ===== 6. 語言溝通能力 ===== -->
    <div class="section">
      <div class="section-title">6. 語言溝通能力</div>
      <table>
        <tr>
          <th style="width:100px;">溝通能力</th>
          <td>${commText}</td>
        </tr>
      </table>
    </div>

    <!-- ===== 7. 意識認知 ===== -->
    <div class="section">
      <div class="section-title">7. 意識認知</div>
      <table>
        <tr>
          <th style="width:100px;">認知能力</th>
          <td>${consciousnessText}</td>
        </tr>
      </table>
    </div>

    <!-- ===== 8. 大小便自制能力 ===== -->
    <div class="section">
      <div class="section-title">8. 大小便自制能力</div>
      <table class="two-col">
        <tr>
          <th>a. 大便</th>
          <td>${bowelText}</td>
          <th>b. 小便</th>
          <td>${bladderText}</td>
        </tr>
        <tr>
          <th>如廁訓練</th>
          <td colspan="3">${bb.toilet_training ? '是' : '否'}</td>
        </tr>
      </table>
    </div>

    <!-- ===== 9. 治療項目 ===== -->
    <div class="section">
      <div class="section-title">9. 治療項目</div>
      <table>
        <tr>
          <th style="width:100px;">接受治療</th>
          <td>${treatmentText}</td>
        </tr>
      </table>
    </div>

    <!-- ===== 10. 情緒 / 行為表現 ===== -->
    <div class="section">
      <div class="section-title">10. 情緒 / 行為表現</div>
      <table class="two-col">
        <tr>
          <th>情緒表現</th>
          <td>${emotionalText}</td>
          <th>行為表現</th>
          <td>${behaviorText}</td>
        </tr>
      </table>
    </div>

    <!-- ===== 11. 備註 ===== -->
    <div class="section">
      <div class="section-title">11. 備註</div>
      <div class="remarks-box">${escapeHtml(assessment.remarks) || '-'}</div>
    </div>

    <!-- ===== 簽署 ===== -->
    <div class="sign-row">
      <div class="sign-box"><span>評估人員簽署:</span></div>
    </div>

    <!-- ===== 頁尾 ===== -->
    <div class="footer">
      <span>${escapeHtml(facilityName)} — 健康評估記錄</span>
    </div>
  </div>
</body>
</html>`;
};

export const printHealthAssessment = async (
  assessment: HealthAssessment,
  patient: PatientInfo
): Promise<void> => {
  const settings = await getFacilitySettings();
  const html = generateHealthAssessmentHtml(assessment, patient, settings.facilityNameZh);

  // 移除舊的 iframe
  const existingIframe = document.getElementById('health-assessment-print-iframe');
  if (existingIframe) {
    document.body.removeChild(existingIframe);
  }

  // 建立隱藏 iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'health-assessment-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert('無法建立列印預覽，請重試');
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };
};
