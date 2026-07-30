import { formatDisplayDate } from './dateFormat';
import { getPrintBedNumber } from './bedTransferUtils';
import type { HealthAssessment } from '../lib/database';
import { getFacilitySettings } from './facilitySettings';

interface PatientInfo {
  床號?: string;
  original_bed_number?: string;
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

const formatDate = (dateStr?: string | null): string => formatDisplayDate(dateStr);

/** Six evaluation-date columns; only the first column is filled. */
const checkboxCells = (checked: boolean): string => {
  return Array.from({ length: 6 }).map((_, i) => {
    const isChecked = i === 0 && checked ? 'checked' : '';
    return `<td><input type="checkbox" class="db-checkbox" ${isChecked}></td>`;
  }).join('');
};

const sideCheckboxCells = (leftChecked: boolean, rightChecked: boolean): string => {
  return Array.from({ length: 6 }).map((_, i) => {
    const l = i === 0 && leftChecked ? 'checked' : '';
    const r = i === 0 && rightChecked ? 'checked' : '';
    return `<td><div class="side-opt"><input type="checkbox" class="db-checkbox" ${l}>左</div><div class="side-opt"><input type="checkbox" class="db-checkbox" ${r}>右</div></td>`;
  }).join('');
};

const textCells = (value: string): string => {
  const esc = escapeHtml(value);
  return Array.from({ length: 6 }).map((_, i) => {
    const v = i === 0 ? esc : '';
    return `<td><input type="text" class="db-text-cell" value="${v}"></td>`;
  }).join('');
};

const dateCells = (dateStr?: string | null): string => textCells(formatDate(dateStr));

/** P2 vision / hearing uses 12 columns (left + right for each of 6 dates). */
const visionCheckboxCells = (leftValue: string, rightValue: string, option: string): string => {
  let cells = '';
  for (let i = 0; i < 6; i++) {
    if (i === 0) {
      const l = leftValue === option ? 'checked' : '';
      const r = rightValue === option ? 'checked' : '';
      cells += `<td><input type="checkbox" class="db-checkbox" ${l}></td><td><input type="checkbox" class="db-checkbox" ${r}></td>`;
    } else {
      cells += '<td><input type="checkbox" class="db-checkbox"></td><td><input type="checkbox" class="db-checkbox"></td>';
    }
  }
  return cells;
};

const visionTextCells = (leftValue: string, rightValue: string): string => {
  const combined = [leftValue && `左：${leftValue}`, rightValue && `右：${rightValue}`].filter(Boolean).join(' / ');
  let cells = '';
  for (let i = 0; i < 6; i++) {
    if (i === 0) {
      cells += `<td colspan="2"><input type="text" class="db-text-cell" value="${escapeHtml(combined)}"></td>`;
    } else {
      cells += '<td colspan="2"><input type="text" class="db-text-cell"></td>';
    }
  }
  return cells;
};

const adlRows = (da: any, key: string, label: string): string => {
  const value = da[key] || '';
  const aid = da[`${key}_aid`] || '';
  const isIndependent = value === '獨立';
  const needsHelp = value === '需要幫助';
  const dependent = value === '完全依賴';
  const hasAid = !!aid;

  if (key === 'bed_transfer') {
    return `
      <tr>
        <th rowspan="4" class="col-m">${label}</th>
        <td class="col-s">獨立</td>
        ${checkboxCells(isIndependent)}
      </tr>
      <tr><td class="col-s">需要幫助</td>${checkboxCells(needsHelp)}</tr>
      <tr><td class="col-s">完全依賴</td>${checkboxCells(dependent)}</tr>
      <tr><td class="col-s">需要輔助器種類：</td>${textCells(aid)}</tr>
    `;
  }

  return `
    <tr>
      <th rowspan="5" class="col-m">${label}</th>
      <td class="col-s">獨立</td>
      ${checkboxCells(isIndependent)}
    </tr>
    <tr><td class="col-s">需要幫助</td>${checkboxCells(needsHelp)}</tr>
    <tr><td class="col-s">完全依賴</td>${checkboxCells(dependent)}</tr>
    <tr><td class="col-s">需要輔助器</td>${checkboxCells(hasAid)}</tr>
    <tr><td class="col-s">種類：</td>${textCells(aid)}</tr>
  `;
};

const generateP1 = (
  assessment: HealthAssessment,
  patient: PatientInfo,
  facilityName: string
): string => {
  const da = assessment.daily_activities || {};
  const smokingHabit = assessment.smoking_habit || '';
  const smokingYears = assessment.smoking_years_quit || '';
  const smokingQty = assessment.smoking_quantity || '';
  const drinkingHabit = assessment.drinking_habit || '';
  const drinkingYears = assessment.drinking_years_quit || '';
  const drinkingQty = assessment.drinking_quantity || '';

  const isSmoking = (key: string) => smokingHabit === key;
  const isDrinking = (key: string) => drinkingHabit === key;

  const limbLeft = Array.isArray(da.limb_movement_left)
    ? da.limb_movement_left
    : parseTextToArray(da.limb_movement_left);
  const limbRight = Array.isArray(da.limb_movement_right)
    ? da.limb_movement_right
    : parseTextToArray(da.limb_movement_right);

  return `
    <div class="page-p1 print-page">
      <div class="container">
        <div class="title-box">
          <h1>${escapeHtml(facilityName)}</h1>
          <h2>院友健康評估及記錄(3 頁)</h2>
        </div>

        <div class="info-row">
          <span>院友姓名：<input type="text" class="db-line-input" style="width: 120px;" value="${escapeHtml(patient.中文姓名 || '')}"></span>
          <span>床號：<input type="text" class="db-line-input" style="width: 60px;" value="${escapeHtml(getPrintBedNumber(patient))}"></span>
          <span>身份證號碼：<input type="text" class="db-line-input" style="width: 150px;" value="${escapeHtml(patient.身份證號碼 || '')}"></span>
        </div>

        <div class="habit-row">
          1. 吸煙習慣：<span class="opt-span"><input type="checkbox" class="db-checkbox" ${isSmoking('從不') ? 'checked' : ''}>從不</span>
          <span class="opt-span"><input type="checkbox" class="db-checkbox" ${isSmoking('已戒') ? 'checked' : ''}>已戒 <input type="text" class="db-line-input" style="width:25px;" value="${escapeHtml(isSmoking('已戒') ? smokingYears : '')}"> 年</span>
          <span class="opt-span"><input type="checkbox" class="db-checkbox" ${isSmoking('每天吸') ? 'checked' : ''}>每天吸 <input type="text" class="db-line-input" style="width:25px;" value="${escapeHtml(isSmoking('每天吸') ? smokingQty : '')}"> 支</span>
          <span class="opt-span"><input type="checkbox" class="db-checkbox" ${isSmoking('間中吸') ? 'checked' : ''}>間中吸</span><br>
          2. 飲酒習慣：<span class="opt-span"><input type="checkbox" class="db-checkbox" ${isDrinking('從不') ? 'checked' : ''}>從不</span>
          <span class="opt-span"><input type="checkbox" class="db-checkbox" ${isDrinking('已戒') ? 'checked' : ''}>已戒 <input type="text" class="db-line-input" style="width:25px;" value="${escapeHtml(isDrinking('已戒') ? drinkingYears : '')}"> 年</span>
          <span class="opt-span"><input type="checkbox" class="db-checkbox" ${isDrinking('每天飲') ? 'checked' : ''}>每天飲多少 <input type="text" class="db-line-input" style="width:40px;" value="${escapeHtml(isDrinking('每天飲') ? drinkingQty : '')}"></span>
          <span class="opt-span"><input type="checkbox" class="db-checkbox" ${isDrinking('間中飲') ? 'checked' : ''}>間中飲</span><br>
          3. 日常活動及自理能力
        </div>

        <table>
          <colgroup>
            <col class="col-m"><col class="col-s"><col class="col-e" span="6">
          </colgroup>

          <tr style="height: 22px;">
            <th colspan="2">觀察日期</th>
            ${dateCells(assessment.assessment_date)}
          </tr>

          <tr>
            <th rowspan="5" class="col-m">最<br>高<br>活<br>動<br>能<br>力</th>
            <td class="col-s">完全獨立</td>
            ${checkboxCells(false)}
          </tr>
          <tr><td class="col-s">協助步行</td>${checkboxCells(false)}</tr>
          <tr><td class="col-s">輪椅</td>${checkboxCells(!!da.is_wheelchair)}</tr>
          <tr><td class="col-s">坐椅</td>${checkboxCells(false)}</tr>
          <tr><td class="col-s">臥床</td>${checkboxCells(!!da.is_bedridden)}</tr>

          <tr>
            <th rowspan="3" class="col-m">肢<br>體<br>活<br>動</th>
            <td class="col-s">完全正常</td>
            ${checkboxCells(limbLeft.includes('完全正常') && limbRight.includes('完全正常'))}
          </tr>
          <tr>
            <td class="col-s">手有障礙</td>
            ${sideCheckboxCells(limbLeft.includes('手有障礙'), limbRight.includes('手有障礙'))}
          </tr>
          <tr>
            <td class="col-s">腳有障礙</td>
            ${sideCheckboxCells(limbLeft.includes('腳有障礙'), limbRight.includes('腳有障礙'))}
          </tr>

          ${adlRows(da, 'eating', '飲<br>食')}
          ${adlRows(da, 'dressing', '穿<br>衣')}
          ${adlRows(da, 'grooming', '梳<br>洗')}
          ${adlRows(da, 'walking', '步<br>行')}
          ${adlRows(da, 'bed_transfer', '上<br>落<br>床')}
          ${adlRows(da, 'bathing', '沐<br>浴')}
          ${adlRows(da, 'toileting', '如<br>廁')}
        </table>

        <div class="footer">
          <div class="page-num">7</div>
          <div class="doc-code">B24 FK (11.2020)</div>
        </div>
      </div>
    </div>
  `;
};

const generateP2 = (assessment: HealthAssessment, facilityName: string): string => {
  const nd = assessment.nutrition_diet || {};
  const vh = assessment.vision_hearing || {};
  const condition = nd.condition || '';
  const mealType = nd.meal_type || '';
  const comm = assessment.communication_ability || '';
  const commOther = assessment.communication_other || '';
  const consciousness = parseTextToArray(assessment.consciousness_cognition);

  const dateFormatted = escapeHtml(formatDate(assessment.assessment_date));

  const heightNum = parseFloat(nd.height);
  const weightNum = parseFloat(nd.weight);
  const bmi = (heightNum > 0 && weightNum > 0)
    ? (weightNum / (heightNum * heightNum)).toFixed(1)
    : '';

  return `
    <div class="page-p2 print-page">
      <div class="container">
        <div class="title-box">
          <h1>${escapeHtml(facilityName)}</h1>
          <h2>院友健康評估及記錄(3 頁)</h2>
        </div>
        <div class="section-title">4. 飲食營養</div>
        <table>
          <colgroup>
            <col class="label-m"><col class="label-s"><col class="col-eval-6" span="6">
          </colgroup>
          <tr style="height: 22px;">
            <th colspan="2">觀察日期</th>
            ${dateCells(assessment.assessment_date)}
          </tr>
          <tr><th rowspan="3" class="label-m">狀<br>況</th><td class="label-s">正常</td>${checkboxCells(condition === '正常')}</tr>
          <tr><td class="label-s">厭食</td>${checkboxCells(condition === '厭食')}</tr>
          <tr><td class="label-s">吞嚥困難</td>${checkboxCells(condition === '吞嚥困難')}</tr>
          <tr><th colspan="2" class="label-s">普通飯餐</th>${checkboxCells(mealType === '普通')}</tr>
          <tr><th colspan="2" class="label-s">特別餐：</th>${checkboxCells(mealType === '特別')}</tr>
          <tr><th colspan="2" class="label-s">鼻胃管/腸胃造口</th>${checkboxCells(condition === '鼻胃管')}</tr>
          <tr style="height: 28px;">
            <th class="label-m">身高<br>(米)</th>
            <th class="label-m">體重<br>(公斤)</th>
            ${textCells(`${nd.height || ''} / ${nd.weight || ''}`)}
          </tr>
          <tr style="height: 28px;">
            <th colspan="2">體質指數 (BMI)<br>(公斤)/(米)²</th>
            ${textCells(bmi)}
          </tr>
        </table>

        <table>
          <colgroup><col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup>
          <tr style="height: 22px;"><th>飲食轉變原因</th><th></th><th>飲食轉變原因</th><th></th></tr>
          <tr style="height: 22px;"><td></td><td></td><td></td><td></td></tr>
          <tr style="height: 22px;"><td></td><td></td><td></td><td></td></tr>
          <tr style="height: 22px;"><td></td><td></td><td></td><td></td></tr>
        </table>

        <div class="section-title">5. 視聽能力</div>
        <table>
          <colgroup>
            <col style="width: 10mm;">
            <col style="width: 25mm;">
            <col span="12" style="width: calc((100% - 35mm) / 12);">
          </colgroup>

          <tr>
            <th colspan="2">觀察日期</th>
            <td colspan="2"><input type="text" class="db-text-cell" value="${dateFormatted}"></td>
            <td colspan="2"><input type="text" class="db-text-cell"></td>
            <td colspan="2"><input type="text" class="db-text-cell"></td>
            <td colspan="2"><input type="text" class="db-text-cell"></td>
            <td colspan="2"><input type="text" class="db-text-cell"></td>
            <td colspan="2"><input type="text" class="db-text-cell"></td>
          </tr>

          <tr style="height: 18px; font-size: 11px;">
            <th colspan="2"></th>
            <th>左</th><th>右</th><th>左</th><th>右</th><th>左</th><th>右</th><th>左</th><th>右</th><th>左</th><th>右</th><th>左</th><th>右</th>
          </tr>

          <tr>
            <th rowspan="5" class="label-m">視<br>力</th>
            <td class="label-s">清楚</td>
            ${visionCheckboxCells(vh.left_eye, vh.right_eye, '清楚')}
          </tr>
          <tr>
            <td class="label-s">視力模糊</td>
            ${visionCheckboxCells(vh.left_eye, vh.right_eye, '視力模糊')}
          </tr>
          <tr>
            <td class="label-s">失明</td>
            ${visionCheckboxCells(vh.left_eye, vh.right_eye, '失明')}
          </tr>
          <tr>
            <td class="label-s">需要輔助器：</td>
            ${visionTextCells(vh.left_eye_aid, vh.right_eye_aid)}
          </tr>
          <tr>
            <td class="label-s">其他</td>
            ${visionTextCells(vh.left_eye_other, vh.right_eye_other)}
          </tr>

          <tr>
            <th rowspan="5" class="label-m">聽<br>力</th>
            <td class="label-s">清楚</td>
            ${visionCheckboxCells(vh.left_ear, vh.right_ear, '清楚')}
          </tr>
          <tr>
            <td class="label-s">聽力衰退</td>
            ${visionCheckboxCells(vh.left_ear, vh.right_ear, '聽力衰退')}
          </tr>
          <tr>
            <td class="label-s">嚴重失聰</td>
            ${visionCheckboxCells(vh.left_ear, vh.right_ear, '嚴重失聰')}
          </tr>
          <tr>
            <td class="label-s">需要助聽器：</td>
            ${visionTextCells('', '')}
          </tr>
          <tr>
            <td class="label-s">其他</td>
            ${visionTextCells(vh.left_ear_other, vh.right_ear_other)}
          </tr>
        </table>

        <div class="section-title">6. 語言溝通能力</div>
        <table>
          <colgroup>
            <col class="label-m"><col class="label-s"><col class="col-eval-6" span="6">
          </colgroup>
          <tr style="height: 22px;">
            <th colspan="2">觀察日期</th>
            ${dateCells(assessment.assessment_date)}
          </tr>
          <tr><th colspan="2" class="label-s">清楚</th>${checkboxCells(comm === '清楚')}</tr>
          <tr><th colspan="2" class="label-s">含糊</th>${checkboxCells(comm === '含糊')}</tr>
          <tr><th colspan="2" class="label-s">無反應</th>${checkboxCells(comm === '無反應')}</tr>
          <tr><th colspan="2" class="label-s">其他</th>${textCells(comm === '其他' ? commOther : '')}</tr>
        </table>

        <div class="section-title">7. 意識認知</div>
        <table>
          <colgroup>
            <col class="label-m"><col class="label-s"><col class="col-eval-6" span="6">
          </colgroup>
          <tr style="height: 22px;">
            <th colspan="2">觀察日期</th>
            ${dateCells(assessment.assessment_date)}
          </tr>
          <tr>
            <th rowspan="5" class="label-m">認<br>知</th>
            <td class="label-s">時間</td>
            ${checkboxCells(consciousness.includes('時間認知'))}
          </tr>
          <tr><td class="label-s">人物</td>${checkboxCells(consciousness.includes('人物認知'))}</tr>
          <tr><td class="label-s">地方</td>${checkboxCells(consciousness.includes('地方認知'))}</tr>
          <tr><td class="label-s">無認知能力</td>${checkboxCells(consciousness.includes('無認知能力'))}</tr>
          <tr><td class="label-s">其他</td>${textCells(consciousness.includes('其他') ? (assessment.consciousness_other || '') : '')}</tr>
        </table>

        <div class="footer">
          <div class="page-num">7</div>
          <div class="doc-code">B24 FK (11.2020)</div>
        </div>
      </div>
    </div>
  `;
};

const generateP3 = (assessment: HealthAssessment, facilityName: string): string => {
  const bb = assessment.bowel_bladder_control || {};
  const emotional = parseTextToArray(assessment.emotional_expression);
  const behavior = parseTextToArray(assessment.behavior_expression);
  const bowel = bb.bowel || '';
  const bladder = bb.bladder || '';

  const behaviorOptions = ['遊走', '逃跑', '暴力', '偷竊', '夢遊', '囤積'];
  const behaviorRows = behaviorOptions.map(option => {
    return `<tr><td class="label-s">${option}</td>${checkboxCells(behavior.includes(option))}</tr>`;
  }).join('');

  return `
    <div class="page-p3 print-page">
      <div class="container">
        <div class="title-box">
          <h1>${escapeHtml(facilityName)}</h1>
          <h2>院友健康評估及記錄(3 頁)</h2>
        </div>
        <div class="section-title">7. 大小便自制能力</div>
        <table>
          <colgroup>
            <col class="label-m"><col class="label-s"><col class="col-eval" span="6">
          </colgroup>
          <tr>
            <th colspan="2">觀察日期</th>
            ${dateCells(assessment.assessment_date)}
          </tr>
          <tr>
            <th colspan="2" class="label-s">需要用尿片</th>
            ${checkboxCells(false)}
          </tr>
          <tr>
            <th rowspan="5" class="label-m">大便</th>
            <td class="label-s">正常</td>
            ${checkboxCells(bowel === '正常')}
          </tr>
          <tr><td class="label-s">便秘</td>${checkboxCells(bowel === '便秘')}</tr>
          <tr><td class="label-s">失禁</td>${checkboxCells(bowel === '失禁')}</tr>
          <tr><td class="label-s">腸造口</td>${checkboxCells(bowel === '腸造口')}</tr>
          <tr><td class="label-s">需要輔助器：</td>${textCells(bowel === '需要輔助器' ? (bb.bowel_aid || '') : '')}</tr>
          <tr>
            <th rowspan="6" class="label-m">小便</th>
            <td class="label-s">正常</td>
            ${checkboxCells(bladder === '正常')}
          </tr>
          <tr><td class="label-s">間歇性失禁</td>${checkboxCells(bladder === '間歇性失禁')}</tr>
          <tr><td class="label-s">完全失禁</td>${checkboxCells(bladder === '完全失禁')}</tr>
          <tr><td class="label-s">造口</td>${checkboxCells(bladder === '小便造口')}</tr>
          <tr><td class="label-s">導尿管</td>${checkboxCells(bladder === '導尿管')}</tr>
          <tr><td class="label-s">需要輔助器：</td>${textCells(bladder === '需要輔助器' ? (bb.bladder_aid || '') : '')}</tr>
        </table>

        <div class="section-title">8. 情緒表現</div>
        <table>
          <colgroup>
            <col class="label-s" style="width: 35mm;"><col class="col-eval" span="6">
          </colgroup>
          <tr>
            <th>觀察日期</th>
            ${dateCells(assessment.assessment_date)}
          </tr>
          <tr><td class="label-s">喜樂</td>${checkboxCells(emotional.includes('喜樂'))}</tr>
          <tr><td class="label-s">平靜</td>${checkboxCells(emotional.includes('平靜'))}</tr>
          <tr><td class="label-s">冷漠</td>${checkboxCells(emotional.includes('冷漠'))}</tr>
          <tr><td class="label-s">抑鬱</td>${checkboxCells(emotional.includes('抑鬱'))}</tr>
          <tr><td class="label-s">激動</td>${checkboxCells(emotional.includes('激動'))}</tr>
          <tr><td class="label-s">其他</td>${checkboxCells(emotional.includes('其他'))}</tr>
        </table>

        <div class="section-title">9. 行為表現</div>
        <table>
          <colgroup>
            <col class="label-s" style="width: 35mm;"><col class="col-eval" span="6">
          </colgroup>
          <tr>
            <th>觀察日期</th>
            ${dateCells(assessment.assessment_date)}
          </tr>
          ${behaviorRows}
        </table>

        <div class="section-title">10. 備註</div>
        <table>
          <colgroup>
            <col class="label-col">
            <col class="col-eval" span="6">
          </colgroup>
          <tr style="height: 22px;">
            <th>觀察日期</th>
            ${dateCells(assessment.assessment_date)}
          </tr>
          <tr style="height: 70px;">
            <td></td>
            ${textCells(assessment.remarks || '')}
          </tr>
        </table>

        <div class="table-gap"></div>

        <table>
          <colgroup>
            <col class="label-col">
            <col class="col-eval" span="6">
          </colgroup>
          <tr style="height: 45px;">
            <td class="sign-label">評估者/記錄者<br>姓名,職位及簽署</td>
            ${textCells(assessment.assessor || '')}
          </tr>
        </table>

        <div class="footer">
          <div class="page-num">7</div>
          <div class="doc-code">B24 FK (11.2020)</div>
        </div>
      </div>
    </div>
  `;
};

export const generateHealthAssessmentHtml = (
  assessment: HealthAssessment,
  patient: PatientInfo,
  facilityName: string
): string => {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <title>院友健康評估及記錄 - ${escapeHtml(patient.中文姓名 || '')}</title>
  <style>
    @page {
      size: A4;
      margin: 5mm 0.25in;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    .print-page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      min-height: 287mm;
    }
    .print-page:last-child {
      page-break-after: avoid;
    }

    /* ── P1 ── */
    .page-p1 {
      font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
      margin: 0; padding: 0;
      background-color: #fff;
      width: 100%;
      color: #000;
      font-size: 13px;
    }
    .page-p1 .container { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; flex: 1; }
    .page-p1 .title-box { position: relative; text-align: center; margin-bottom: 8px; }
    .page-p1 .title-box h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; }
    .page-p1 .title-box h2 { margin: 4px 0 0 0; font-size: 20px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
    .page-p1 .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-weight: bold; }
    .page-p1 .db-line-input { border: none; border-bottom: 1px solid black; background: transparent; font-family: inherit; font-size: 13px; }
    .page-p1 .habit-row { font-weight: bold; line-height: 1.2; margin-bottom: 2px; }
    .page-p1 .db-checkbox { width: 13px; height: 13px; vertical-align: middle; cursor: pointer; }
    .page-p1 .opt-span { margin-right: 8px; white-space: nowrap; font-size: 12px; }
    .page-p1 table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .page-p1 th, .page-p1 td { border: 1px solid black; text-align: center; vertical-align: middle; padding: 0px 1px; height: 22px; font-size: 11px; }
    .page-p1 .col-m { width: 8.5mm; font-weight: bold; line-height: 1.0; font-size: 11px; }
    .page-p1 .col-s { width: 26mm; font-weight: bold; text-align: left; padding-left: 2px; }
    .page-p1 .col-e { width: auto; }
    .page-p1 .db-text-cell { width: 100%; border: none; background: transparent; font-family: inherit; text-align: center; outline: none; font-size: 11px; }
    .page-p1 .side-opt { display: inline-flex; align-items: center; margin: 0 1px; font-size: 10px; font-weight: normal; }
    .page-p1 .footer { margin-top: auto; display: flex; justify-content: flex-end; position: relative; height: 30px; font-weight: bold; }
    .page-p1 .page-num { position: absolute; left: 50%; transform: translateX(-50%); font-size: 24px; font-weight: bold; bottom: 0; }
    .page-p1 .doc-code { font-size: 11px; font-weight: bold; align-self: flex-end; }
    .page-p1 tr { page-break-inside: avoid; }

    /* ── P2 ── */
    .page-p2 {
      font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
      margin: 0; padding: 0;
      background-color: #fff;
      width: 100%;
      color: #000;
    }
    .page-p2 .container { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; flex: 1; }
    .page-p2 .title-box { position: relative; text-align: center; margin-bottom: 6px; }
    .page-p2 .title-box h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; }
    .page-p2 .title-box h2 { margin: 4px 0 0 0; font-size: 20px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
    .page-p2 .section-title { font-size: 16px; font-weight: bold; margin: 6px 0 2px 15px; }
    .page-p2 table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 8px; }
    .page-p2 th, .page-p2 td { border: 1px solid black; text-align: center; vertical-align: middle; padding: 0px; height: 22px; font-size: 13px; }
    .page-p2 .bold { font-weight: bold; }
    .page-p2 .label-m { width: 10mm; font-weight: bold; font-size: 15px; line-height: 1.1; }
    .page-p2 .label-s { width: 25mm; font-weight: bold; text-align: left; padding-left: 3px; font-size: 12px; }
    .page-p2 .col-eval { width: auto; }
    .page-p2 .col-eval-6 { width: auto; }
    .page-p2 .db-text-cell { width: 100%; height: 100%; border: none; background: transparent; font-family: inherit; font-size: 12px; text-align: center; outline: none; display: block; box-sizing: border-box; }
    .page-p2 .footer { display: flex; justify-content: flex-end; position: relative; height: 30px; font-weight: bold; margin-top: auto; }
    .page-p2 .page-num { position: absolute; left: 50%; transform: translateX(-50%); font-size: 24px; font-weight: bold; bottom: 0; }
    .page-p2 .doc-code { font-size: 11px; font-weight: bold; align-self: flex-end; }

    /* ── P3 ── */
    .page-p3 {
      font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
      margin: 0; padding: 0;
      background-color: #fff;
      width: 100%;
      color: #000;
    }
    .page-p3 .container { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; flex: 1; }
    .page-p3 .title-box { position: relative; text-align: center; margin-bottom: 6px; }
    .page-p3 .title-box h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; }
    .page-p3 .title-box h2 { margin: 4px 0 0 0; font-size: 20px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
    .page-p3 .section-title { font-size: 14px; font-weight: bold; margin: 6px 0 2px 15px; }
    .page-p3 table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 0; }
    .page-p3 th, .page-p3 td { border: 1px solid black; text-align: center; vertical-align: middle; padding: 1px 2px; height: 22px; font-size: 11px; }
    .page-p3 .bold { font-weight: bold; }
    .page-p3 .label-col { width: 35mm; text-align: center; font-weight: bold; }
    .page-p3 .sign-label { text-align: left; vertical-align: top; padding: 4px; line-height: 1.3; }
    .page-p3 .table-gap { height: 4px; }
    .page-p3 .db-text-cell { width: 100%; height: 100%; border: none; background: transparent; font-family: inherit; font-size: 12px; text-align: center; outline: none; }
    .page-p3 .footer { display: flex; justify-content: flex-end; position: relative; height: 30px; font-weight: bold; margin-top: auto; }
    .page-p3 .page-num { position: absolute; left: 50%; transform: translateX(-50%); font-size: 24px; font-weight: bold; bottom: 0; }
    .page-p3 .doc-code { font-size: 11px; font-weight: bold; align-self: flex-end; }
  </style>
</head>
<body>
  ${generateP1(assessment, patient, facilityName)}
  ${generateP2(assessment, facilityName)}
  ${generateP3(assessment, facilityName)}
</body>
</html>`;
};

export const printHealthAssessment = async (
  assessment: HealthAssessment,
  patient: PatientInfo
): Promise<void> => {
  const settings = await getFacilitySettings();
  const html = generateHealthAssessmentHtml(assessment, patient, settings.facilityNameZh);

  const existingIframe = document.getElementById('health-assessment-print-iframe');
  if (existingIframe) {
    document.body.removeChild(existingIframe);
  }

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
