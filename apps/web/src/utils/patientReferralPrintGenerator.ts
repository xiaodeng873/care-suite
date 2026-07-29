import type { Patient, MealGuidance, MealCombinationType, SpecialDietType, PatientTubeCareRecord, MedicationPrescription, DiagnosisRecord, PatientContact, PatientHealthTask, PatientRestraintAssessment } from '../lib/database';
import type { HospitalEpisode } from './erRecordPrintGenerator';
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';
import { getMealGuidances, getTubeCareRecords, getPrescriptions, getDiagnosisRecordsByPatientId, getPatientContacts, getHealthTasks, getRestraintAssessments } from '../lib/database';
import { calcAge } from './cgatFeeHelper';
import { formatDisplayDate } from './dateFormat';

const escapeHtml = (text: string | number | undefined | null): string => {
  if (text == null || text === '') return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
};

const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return formatDisplayDate(d);
};

const checkbox = (label: string, checked = false) => `
  <label class="cb-item">
    <input type="checkbox" ${checked ? 'checked' : ''} disabled>
    <span>${escapeHtml(label)}</span>
  </label>`;

const inputLine = (width = '100%', placeholder = '') => `<input type="text" class="db-line-input" style="width:${width};" placeholder="${escapeHtml(placeholder)}" readonly>`;

const sectionHeader = (num: number | string, title: string) => `
  <div class="section-header">
    <span class="section-num">(${num})</span>
    <span class="section-title">${escapeHtml(title)}</span>
  </div>`;

interface FacilitySettingsInfo {
  facilityNameZh: string;
  facilityNameEn: string;
  facilityAddressZh: string;
  facilityAddressEn: string;
  facilityPhone: string;
  facilityFax: string;
}

const MEAL_COMBINATIONS: MealCombinationType[] = [
  '正飯+正餸', '正飯+碎餸', '正飯+糊餸',
  '軟飯+正餸', '軟飯+碎餸', '軟飯+糊餸',
  '糊飯+糊餸', '不適用'
];

const SPECIAL_DIETS: SpecialDietType[] = ['糖尿餐', '痛風餐', '低鹽餐', '鼻胃飼'];

const facilityHeader = (settings: FacilitySettingsInfo, compact = false) => {
  const nameEn = settings.facilityNameEn ? ` / ${escapeHtml(settings.facilityNameEn)}` : '';
  const addrEn = settings.facilityAddressEn ? `<br>${escapeHtml(settings.facilityAddressEn)}` : '';
  const phone = settings.facilityPhone ? `電話：${escapeHtml(settings.facilityPhone)}` : '';
  const fax = settings.facilityFax ? `傳真：${escapeHtml(settings.facilityFax)}` : '';
  return `
  <div class="facility-header ${compact ? 'compact' : ''}">
    <div class="facility-name">
      <h1>${escapeHtml(settings.facilityNameZh)}${nameEn}</h1>
    </div>
    <div class="facility-contact">
      <div class="facility-address">${escapeHtml(settings.facilityAddressZh)}${addrEn}</div>
      <div class="facility-phone-fax">${phone}　${fax}</div>
    </div>
  </div>`;
};

const patientHeaderBlock = (patient: Patient) => {
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const enName = patient.英文姓名 || `${patient.英文姓氏 || ''} ${patient.英文名字 || ''}`.trim();
  const age = calcAge(patient.出生日期);
  const genderAge = patient.性別 ? `${patient.性別}${age !== null ? ` / ${age}歲` : ''}` : '';
  const bed = patient.床號 || '';
  const idNumber = patient.身份證號碼 || '';
  const birthDate = formatDate(patient.出生日期);
  const contactPhone = patient.通訊電話 || '';

  return `
  <div class="patient-header">
    <div class="info-row">
      <div class="info-item" style="flex:2;">
        <span class="info-label">院友姓名：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(patientName)}" readonly>
        <span class="en-name">${escapeHtml(enName)}</span>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">性別 / 年齡：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(genderAge)}" readonly>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">房號/床號：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(bed)}" readonly>
      </div>
    </div>
    <div class="info-row">
      <div class="info-item" style="flex:1;">
        <span class="info-label">出生日期：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(birthDate)}" readonly>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">身份證號碼：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(idNumber)}" readonly>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">聯絡電話：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(contactPhone)}" readonly>
      </div>
    </div>
  </div>`;
};

const topExtraBlock = (contacts: PatientContact[], advanceDirectiveTasks: PatientHealthTask[]) => {
  const hasAdvanceDirective = advanceDirectiveTasks.length > 0;
  const latestSignatureDate = advanceDirectiveTasks
    .filter(t => t.last_completed_at)
    .sort((a, b) => new Date(b.last_completed_at!).getTime() - new Date(a.last_completed_at!).getTime())[0]?.last_completed_at;

  const contactText = contacts.length > 0
    ? contacts.map(c => {
        const parts = [c.聯絡人姓名, c.關係, c.聯絡電話].filter(Boolean);
        let text = parts.join(' / ');
        if (c.is_primary) text += ' [第一聯絡人]';
        return text;
      }).join('；')
    : '';

  return `
  <div class="top-extra-box">
    <div class="info-row">
      <div class="info-item" style="flex:3;">
        <span class="info-label">聯絡人 / 關係 / 電話：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(contactText)}" readonly>
      </div>
    </div>
    <div class="info-row">
      <div class="info-item" style="flex:1;">
        <span class="info-label">預設醫療指示：</span>
        <input type="text" class="db-line-input" value="${hasAdvanceDirective ? '有' : '無'}" readonly>
      </div>
      <div class="info-item" style="flex:2;">
        <span class="info-label">預設醫療指示日期：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(formatDate(latestSignatureDate))}" readonly>
      </div>
    </div>
    <div class="info-row">
      <div class="info-item" style="flex:1;">
        <span class="info-label">院舍處理方法：</span>
        <input type="text" class="db-line-input" readonly>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">入院前最後服藥時間：</span>
        <input type="text" class="db-line-input" placeholder="am/pm" readonly>
      </div>
    </div>
  </div>`;
};

const reasonCheckboxes = () => `
  <div class="reason-grid">
    ${checkbox('靜脈針管脫出')}
    ${checkbox('胃管脫出')}
    ${checkbox('導尿管脫出')}
    ${checkbox('皮膚流膿發炎')}
    ${checkbox('跌倒受傷')}
    ${checkbox('整體情況轉差')}
    ${checkbox('生命指標異常')}
    ${checkbox('持續心痛')}
    ${checkbox('氣促')}
    ${checkbox('嘔吐')}
    ${checkbox('肚瀉')}
    ${checkbox('不肯進食')}
    ${checkbox('不醒人事')}
    ${checkbox('神智昏亂')}
    ${checkbox('手腳癱瘓')}
    ${checkbox('發熱發冷')}
    ${checkbox('頭暈')}
  </div>`;

const formatFrequency = (p: MedicationPrescription): string => {
  const parts: string[] = [];
  if (p.is_prn) parts.push('PRN');
  switch (p.frequency_type) {
    case 'daily':
      parts.push(p.daily_frequency ? `每天${p.daily_frequency}次` : '每天');
      break;
    case 'every_x_days':
      parts.push(p.frequency_value ? `每${p.frequency_value}天` : '每X天');
      break;
    case 'every_x_months':
      parts.push(p.frequency_value ? `每${p.frequency_value}月` : '每X月');
      break;
    case 'weekly_days':
      parts.push('每週指定日子');
      break;
    case 'odd_even_days':
      parts.push(p.is_odd_even_day === 'odd' ? '單日' : p.is_odd_even_day === 'even' ? '雙日' : '單雙日');
      break;
    case 'hourly':
      parts.push('每小時');
      break;
    default:
      break;
  }
  if (p.medication_time_slots && p.medication_time_slots.length > 0) {
    parts.push(p.medication_time_slots.join(','));
  }
  if (p.meal_timing) parts.push(p.meal_timing);
  return parts.join(' ');
};

const page1 = (patient: Patient, episode: HospitalEpisode, activePrescriptions: MedicationPrescription[], diagnosisRecords: DiagnosisRecord[], contacts: PatientContact[], advanceDirectiveTasks: PatientHealthTask[], settings: FacilitySettingsInfo): string => {
  const hasAllergy = patient.藥物敏感 && patient.藥物敏感.length > 0;
  const allergyDetail = hasAllergy ? (patient.藥物敏感 || []).join(', ') : '';
  const adverseReactions = patient.不良藥物反應 && patient.不良藥物反應.length > 0
    ? (patient.不良藥物反應 || []).join(', ')
    : '不詳';

  const medRows = activePrescriptions.length > 0 ? activePrescriptions : [];
  const diagnosisText = diagnosisRecords.length > 0
    ? diagnosisRecords.map(d => {
        const parts = [d.diagnosis_item, d.diagnosis_unit, d.diagnosis_date ? formatDate(d.diagnosis_date) : ''].filter(Boolean);
        return parts.join(' / ');
      }).join('；')
    : '';

  return `
<div class="container">
  ${facilityHeader(settings)}

  <div class="title-section">
    <h2>院友送診資料</h2>
    <h3>Patient Referral Form</h3>
  </div>

  ${patientHeaderBlock(patient)}
  ${topExtraBlock(contacts, advanceDirectiveTasks)}

  ${sectionHeader('1', '出診原因 Reason for Referral')}
  <div class="reason-box">
    <div class="reason-title">其他求診原因（必須註明）</div>
    ${reasonCheckboxes()}
  </div>
  <div class="lined-box" style="height:44px;">${inputLine('100%')}</div>

  ${sectionHeader('2', '生命指標 Vital Signs')}
  <div class="vital-grid">
    <div class="vital-cell"><span class="vital-label">血壓 BP</span>mmHg<div class="vital-input"></div></div>
    <div class="vital-cell"><span class="vital-label">脈搏/心跳 Pulse</span>/min<div class="vital-input"></div></div>
    <div class="vital-cell"><span class="vital-label">呼吸 RR</span>/min<div class="vital-input"></div></div>
    <div class="vital-cell"><span class="vital-label">體溫 Temp</span>°C<div class="vital-input"></div></div>
    <div class="vital-cell"><span class="vital-label">血糖 BG</span>mmol/L<div class="vital-input"></div></div>
    <div class="vital-cell"><span class="vital-label">血含氧量 SpO₂</span>%<div class="vital-input"></div></div>
  </div>

  <div class="mental-row">
    <div><span class="info-label">usual mental status：</span>Alert / confused / withdrawn / Wanders</div>
    <div><span class="info-label">Communication problems：</span>Yes / No</div>
    <div><span class="info-label">History of fall within 3 months：</span>Yes / No</div>
  </div>

  ${sectionHeader('3', '診斷 Diagnosis')}
  <div class="lined-box" style="height:48px;">
    <input type="text" class="db-line-input" value="${escapeHtml(diagnosisText)}" style="width:100%;" readonly>
  </div>

  ${sectionHeader('4', '過敏反應 Allergy')}
  <div class="allergy-box">
    <div class="info-row">
      <div class="info-item" style="flex:1;">
        <span class="info-label">過敏藥物：</span>
        <input type="text" class="db-line-input" value="${hasAllergy ? escapeHtml(allergyDetail) : 'NKDA'}" readonly>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">不良反應：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(adverseReactions)}" readonly>
      </div>
    </div>
  </div>

  ${sectionHeader('5', '現時藥物 Current Medications')}
  <div class="med-note">（如正在院舍接受靜脈注射藥物，請影印藥物記錄表帶回醫院）</div>
  <table class="med-table">
    <thead>
      <tr>
        <th style="width:6%">#</th>
        <th style="width:46%">藥物名稱、劑型、劑量、使用次數、途徑</th>
        <th style="width:16%">開始日期</th>
        <th style="width:16%">預計完成</th>
        <th style="width:16%">藥物來源</th>
      </tr>
    </thead>
    <tbody>
      ${medRows.length > 0 ? medRows.map((p, i) => {
        const nameParts = [p.medication_name, p.dosage_form, p.dosage_amount && p.dosage_unit ? `${p.dosage_amount}${p.dosage_unit}` : p.dosage_amount].filter(Boolean);
        const freq = formatFrequency(p);
        const route = p.administration_route || '';
        const col2 = escapeHtml([nameParts.join(' '), freq, route].filter(Boolean).join(' / '));
        const endDate = p.end_date || p.estimated_end_date || '';
        return `<tr>
          <td>${i + 1}</td>
          <td>${col2}</td>
          <td>${formatDate(p.start_date)}</td>
          <td>${formatDate(endDate)}</td>
          <td>${escapeHtml(p.medication_source || '')}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="5" style="text-align:center;">院友沒有在服處方</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <div class="page-num">共 1/2 頁</div>
  </div>
</div>`;
};

const mealSection = (mealGuidance?: MealGuidance) => {
  const selected = mealGuidance?.meal_combination || '';
  const isTube = (mealGuidance?.special_diets || []).includes('鼻胃飼');
  return `
  ${sectionHeader('6', '餐食種類 Diet')}
  <div class="meal-grid">
    ${MEAL_COMBINATIONS.map(c => checkbox(c, c === selected)).join('')}
  </div>
  ${isTube ? `
  <div class="tube-feeding-info">
    <div class="info-row">
      <div class="info-item" style="flex:1;">
        <span class="info-label">鼻胃管奶水品牌：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(mealGuidance?.tube_feeding_brand || '')}" readonly>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">鼻胃管每天餐量（ml）：</span>
        <input type="text" class="db-line-input" value="${escapeHtml(mealGuidance?.tube_feeding_daily_amount_ml || '')}" readonly>
      </div>
    </div>
  </div>` : ''}`;
};

const specialDietSection = (mealGuidance?: MealGuidance) => {
  const selected = mealGuidance?.special_diets || [];
  return `
  ${sectionHeader('7', '特別餐 Special Diet')}
  <div class="checkbox-grid four-cols">
    ${SPECIAL_DIETS.map(d => checkbox(d, selected.includes(d))).join('')}
  </div>`;
};

const thickenerSection = (mealGuidance?: MealGuidance) => {
  const has = !!mealGuidance?.needs_thickener;
  const amount = mealGuidance?.thickener_amount || '';
  return `
  ${sectionHeader('8', '凝固粉 Thickener')}
  <div class="checkbox-grid four-cols">
    ${checkbox('沒有', !has)}
    ${checkbox('有', has)}
    <div class="thickener-amount">
      <span class="info-label">分量：</span>
      <input type="text" class="db-line-input" value="${escapeHtml(amount)}" readonly>
    </div>
  </div>`;
};

const feedingSection = (mealGuidance?: MealGuidance) => {
  const isTube = (mealGuidance?.special_diets || []).includes('鼻胃飼');
  const needsFeeding = !!mealGuidance?.needs_feeding;
  return `
  ${sectionHeader('9', '進食 Feeding')}
  <div class="checkbox-grid three-cols">
    ${checkbox('自助', !isTube && !needsFeeding)}
    ${checkbox('需餵食', !isTube && needsFeeding)}
  </div>`;
};

const tubeFeedingSection = (mealGuidance?: MealGuidance, tubeCareRecord?: PatientTubeCareRecord) => {
  const isTube = (mealGuidance?.special_diets || []).includes('鼻胃飼');
  return `
  ${sectionHeader('10', '管餵飼 Tube Feeding')}
  <div class="tube-grid">
    <div class="tube-cell">
      <span class="tube-label">鼻胃管奶水品牌</span>
      <div class="tube-value">${escapeHtml(mealGuidance?.tube_feeding_brand || '')}</div>
    </div>
    <div class="tube-cell">
      <span class="tube-label">鼻胃管每天餐量 (ml)</span>
      <div class="tube-value">${escapeHtml(mealGuidance?.tube_feeding_daily_amount_ml || '')}</div>
    </div>
    <div class="tube-cell">
      <span class="tube-label">鼻胃管更換日期</span>
      <div class="tube-value">${isTube ? formatDate(tubeCareRecord?.execution_date) : ''}</div>
    </div>
    <div class="tube-cell">
      <span class="tube-label">鼻胃管尺寸</span>
      <div class="tube-value">${isTube ? escapeHtml(tubeCareRecord?.tube_size || '') : ''}</div>
    </div>
  </div>`;
};

const restraintItemsSection = (restraintAssessment?: PatientRestraintAssessment) => {
  const suggested = restraintAssessment?.suggested_restraints;
  const allOptions = ['約束衣', '約束腰帶', '手腕帶', '約束手套/連指手套', '防滑褲/防滑褲帶', '枱板', '其他：'];
  const items = allOptions.map(name => {
    const config = suggested?.[name];
    const checked = config && typeof config === 'object' && (config as any).checked === true;
    let displayName = name;
    if (name === '其他：' && checked) {
      const otherName = (config as any)?.otherRestraintType || (config as any)?.['名稱'];
      if (otherName) displayName = `其他：${otherName}`;
    }
    return checkbox(displayName, checked);
  }).join('');
  return `
  ${sectionHeader('15', '約束物品 Restraint Items')}
  <div class="checkbox-grid four-cols">
    ${items}
  </div>
  <div class="lined-box" style="height:22px;">${inputLine('100%')}</div>`;
};

const personalBelongingsSection = () => `
  <div class="belongings-section">
    <div class="belongings-grid">
      <div class="belongings-block">
        <div class="belongings-title">假牙 Dentures</div>
        <div class="checkbox-grid two-cols">
          ${checkbox('上顎')}
          ${checkbox('下顎')}
        </div>
      </div>
      <div class="belongings-block">
        <div class="belongings-title">助聽器 Hearing Aid</div>
        <div class="checkbox-grid two-cols">
          ${checkbox('左耳')}
          ${checkbox('右耳')}
        </div>
      </div>
      <div class="belongings-block">
        <div class="belongings-title">隨身物品</div>
        <div class="checkbox-grid two-cols">
          ${checkbox('眼鏡')}
          ${checkbox('手提電話')}
          ${checkbox('充電器')}
          ${checkbox('錢包')}
        </div>
      </div>
    </div>
  </div>`;

const page2 = (patient: Patient, mealGuidance?: MealGuidance, tubeCareRecord?: PatientTubeCareRecord, restraintAssessment?: PatientRestraintAssessment, settings?: FacilitySettingsInfo): string => {
  return `
<div class="container">
  ${facilityHeader(settings || DEFAULT_FACILITY_SETTINGS as FacilitySettingsInfo, true)}

  <div class="title-section">
    <h2>院友送診資料</h2>
    <h3>Patient Referral Form</h3>
  </div>

  ${mealSection(mealGuidance)}
  ${specialDietSection(mealGuidance)}
  ${thickenerSection(mealGuidance)}
  ${feedingSection(mealGuidance)}
  ${tubeFeedingSection(mealGuidance, tubeCareRecord)}

  <div class="two-col-sections">
    <div class="half-section">
      ${sectionHeader('11', '沐浴能力 Bathing')}
      <div class="checkbox-grid two-cols">
        ${checkbox('自助')}
        ${checkbox('需要協助')}
      </div>
    </div>
    <div class="half-section">
      ${sectionHeader('12', '活動能力 Mobility')}
      <div class="checkbox-grid two-cols">
        ${checkbox('自助')}
        ${checkbox('需要協助')}
        ${checkbox('坐椅')}
        ${checkbox('臥床')}
      </div>
    </div>
  </div>

  ${sectionHeader('13', '助行器 Walking Aids')}
  <div class="checkbox-grid six-cols">
    ${checkbox('士的')}
    ${checkbox('四腳叉')}
    ${checkbox('助行架')}
    ${checkbox('輪椅')}
    ${checkbox('其他')}
    ${checkbox('不適用')}
  </div>
  <div class="lined-box" style="height:22px;">${inputLine('100%')}</div>

  ${sectionHeader('14', '排泄 Elimination')}
  <div class="checkbox-grid four-cols">
    ${checkbox('沒有')}
    ${checkbox('小便失禁')}
    ${checkbox('大便失禁')}
    ${checkbox('大小便失禁')}
  </div>

  ${restraintItemsSection(restraintAssessment)}

  <div class="two-col-sections">
    <div class="half-section">
      ${sectionHeader('16', '床 <=> 椅 Transfer')}
      <div class="checkbox-grid one-col">
        ${checkbox('自助')}
        ${checkbox('一人扶抱')}
        ${checkbox('雙人扶抱')}
      </div>
    </div>
    <div class="half-section">
      ${sectionHeader('17', '椅上調整位置 Reposition in Chair')}
      <div class="checkbox-grid one-col">
        ${checkbox('自助')}
        ${checkbox('一人扶抱')}
        ${checkbox('雙人扶抱')}
      </div>
    </div>
  </div>

  ${sectionHeader('18', '本次送診帶備之個人財物 Personal Belongings')}
  ${personalBelongingsSection()}

  <div class="staff-footer">
    <div class="info-row">
      <div class="info-item" style="flex:1;">
        <span class="info-label">當值職員姓名：</span>
        <input type="text" class="db-line-input" readonly>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">聯絡電話：</span>
        <input type="text" class="db-line-input" readonly>
      </div>
    </div>
    <div class="info-row">
      <div class="info-item" style="flex:1;">
        <span class="info-label">院舍職員 / 外展：</span>
        <input type="text" class="db-line-input" readonly>
      </div>
      <div class="info-item" style="flex:1;">
        <span class="info-label">職級：</span>
        <span class="rank-options">RN　EN　HCW　HW　PCW　Dr　其他</span>
      </div>
    </div>
    <div class="info-row">
      <div class="info-item" style="flex:1;">
        <span class="info-label">備註：</span>
        <input type="text" class="db-line-input" readonly>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="page-num">共 2/2 頁</div>
  </div>
</div>`;
};

const baseCss = `
  @page { size: A4 portrait; margin: 6mm 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
    margin: 0;
    padding: 0;
    background-color: #fff;
    color: #000;
    font-size: 10px;
    line-height: 1.3;
    transform: scale(1.2);
    transform-origin: top left;
    width: calc(100% / 1.2);
  }
  .no-print { text-align: center; margin: 10px; }
  .no-print button { padding: 8px 20px; font-size: 12px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  .container {
    width: 100%;
    box-sizing: border-box;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .container:last-of-type { page-break-after: auto; }

  .facility-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1.5px solid black;
    padding-bottom: 3px;
    margin-bottom: 4px;
  }
  .facility-header.compact { margin-bottom: 3px; }
  .facility-name h1 {
    margin: 0;
    font-size: 14px;
    font-weight: bold;
  }
  .facility-contact {
    text-align: right;
    font-size: 9px;
    line-height: 1.25;
  }
  .facility-address { font-weight: bold; }
  .facility-phone-fax { margin-top: 1px; }

  .title-section {
    text-align: center;
    margin-bottom: 4px;
  }
  .title-section h2 {
    margin: 0;
    font-size: 18px;
    font-weight: bold;
    display: inline-block;
    border-bottom: 1.5px solid black;
    padding-bottom: 1px;
  }
  .title-section h3 {
    margin: 1px 0 0 0;
    font-size: 11px;
    font-weight: normal;
  }

  .patient-header {
    border: 1.5px solid black;
    padding: 4px;
    margin-bottom: 4px;
  }
  .top-extra-box {
    border: 1.5px solid black;
    border-top: none;
    padding: 4px;
    margin-bottom: 4px;
  }
  .info-row {
    display: flex;
    gap: 8px;
    margin-bottom: 3px;
  }
  .info-row:last-child { margin-bottom: 0; }
  .info-item {
    display: flex;
    align-items: center;
    flex: 1;
  }
  .info-label {
    font-weight: bold;
    white-space: nowrap;
    margin-right: 3px;
  }
  .en-name {
    font-size: 9px;
    margin-left: 4px;
    color: #333;
  }
  .db-line-input {
    border: none;
    border-bottom: 1px solid black;
    background: transparent;
    font-family: inherit;
    font-size: 10px;
    padding: 0 3px;
    flex: 1;
    outline: none;
    min-width: 30px;
  }
  .db-text-cell {
    width: 100%;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 10px;
    text-align: center;
    outline: none;
  }

  .reason-box {
    border: 1.5px solid black;
    border-bottom: none;
    padding: 5px 5px;
  }
  .reason-title {
    font-weight: bold;
    margin-bottom: 4px;
  }
  .reason-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #f0f0f0;
    border: 1.5px solid black;
    border-bottom: none;
    padding: 2px 4px;
    margin-top: 7px;
    page-break-after: avoid;
  }
  .section-num {
    font-weight: bold;
    font-size: 11px;
  }
  .section-title {
    font-weight: bold;
    font-size: 11px;
  }

  .lined-box {
    border: 1.5px solid black;
    border-top: none;
    padding: 4px 4px;
    display: flex;
    align-items: center;
  }

  .vital-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border: 1.5px solid black;
    border-top: none;
  }
  .vital-cell {
    border-right: 1px solid black;
    padding: 4px 1px;
    text-align: center;
    font-size: 9px;
  }
  .vital-cell:last-child { border-right: none; }
  .vital-label { display: block; font-weight: bold; margin-bottom: 2px; }
  .vital-input { border-bottom: 1px solid black; height: 18px; margin: 3px 4px; }

  .mental-row {
    border: 1.5px solid black;
    border-top: none;
    padding: 4px 4px;
    display: flex;
    gap: 16px;
    font-size: 9px;
  }

  .allergy-box {
    border: 1.5px solid black;
    border-top: none;
    padding: 5px 5px;
  }
  .med-note {
    border: 1.5px solid black;
    border-top: none;
    border-bottom: none;
    padding: 2px 4px;
    font-size: 9px;
    background: #fff;
  }
  .med-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1.5px solid black;
    border-top: none;
  }
  .med-table th, .med-table td {
    border: 1px solid black;
    text-align: center;
    vertical-align: middle;
    height: 22px;
    padding: 0;
    font-size: 9px;
  }
  .med-table th { font-weight: bold; background: #fff; }
  .med-table td { text-align: left; padding-left: 4px; }
  .med-table thead { display: table-header-group; }
  .med-table tbody { display: table-row-group; }
  .med-table tr { page-break-inside: avoid; }

  .meal-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px 8px;
    border: 1.5px solid black;
    border-top: none;
    padding: 5px 5px;
  }
  .meal-grid .cb-item { font-size: 9px; }
  .tube-feeding-info {
    border: 1.5px solid black;
    border-top: none;
    padding: 5px 5px;
  }

  .checkbox-grid {
    display: grid;
    gap: 3px 8px;
    border: 1.5px solid black;
    border-top: none;
    padding: 5px 5px;
  }
  .checkbox-grid.two-cols { grid-template-columns: repeat(2, 1fr); }
  .checkbox-grid.three-cols { grid-template-columns: repeat(3, 1fr); }
  .checkbox-grid.four-cols { grid-template-columns: repeat(4, 1fr); }
  .checkbox-grid.six-cols { grid-template-columns: repeat(6, 1fr); }
  .checkbox-grid.one-col { grid-template-columns: 1fr; }
  .cb-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
  }
  .cb-item input { width: 10px; height: 10px; margin: 0; }
  .checkbox-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .checkbox-col.small { gap: 0; }
  .checkbox-col.small .cb-item { font-size: 8px; }

  .thickener-amount {
    display: flex;
    align-items: center;
    gap: 4px;
    grid-column: span 2;
  }

  .tube-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 1.5px solid black;
    border-top: none;
  }
  .tube-cell {
    border-right: 1px solid black;
    padding: 4px 3px;
    text-align: center;
  }
  .tube-cell:last-child { border-right: none; }
  .tube-label { font-size: 9px; font-weight: bold; display: block; }
  .tube-value {
    border-bottom: 1px solid black;
    height: 18px;
    margin: 3px 4px;
    font-size: 9px;
    text-align: center;
  }

  .two-col-sections {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .half-section .section-header { margin-top: 7px; }
  .half-section:first-child .section-header,
  .half-section:first-child .checkbox-grid,
  .half-section:first-child .checkbox-col {
    border-right: none;
  }
  .half-section .checkbox-grid { border-top: none; border-right: 1.5px solid black; }
  .half-section:last-child .checkbox-grid { border-right: 1.5px solid black; }

  .diabetic-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    border: 1.5px solid black;
    border-top: none;
  }
  .diabetic-col {
    border-right: 1px solid black;
    padding: 4px 4px;
  }
  .diabetic-col:last-child { border-right: none; }
  .diabetic-title { font-weight: bold; font-size: 9px; margin-bottom: 3px; }

  .belongings-section {
    margin-top: 7px;
    page-break-inside: avoid;
  }
  .belongings-section .section-header { border-bottom: none; page-break-after: avoid; }
  .belongings-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    border: 1.5px solid black;
    border-top: none;
    page-break-inside: avoid;
  }
  .belongings-block {
    border-right: 1px solid black;
    padding: 6px 5px;
    page-break-inside: avoid;
  }
  .belongings-block:last-child { border-right: none; }
  .belongings-title { font-weight: bold; font-size: 9px; margin-bottom: 3px; }

  .rank-options { font-size: 9px; letter-spacing: 1px; }

  .footer {
    display: flex;
    justify-content: center;
    padding-top: 8px;
  }
  .page-num {
    font-size: 10px;
  }

  .staff-footer {
    border: 1.5px solid black;
    padding: 5px 5px;
    margin-top: 8px;
    page-break-inside: avoid;
  }

  @media print {
    .no-print { display: none !important; }
  }
`;

const generatePatientReferralHtml = (
  patient: Patient,
  episode: HospitalEpisode,
  activePrescriptions: MedicationPrescription[],
  diagnosisRecords: DiagnosisRecord[],
  contacts: PatientContact[],
  advanceDirectiveTasks: PatientHealthTask[],
  settings: FacilitySettingsInfo,
  mealGuidance?: MealGuidance,
  tubeCareRecord?: PatientTubeCareRecord,
  restraintAssessment?: PatientRestraintAssessment
): string => {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>院友送診資料 - ${escapeHtml(patient.中文姓名 || '')}</title>
<style>${baseCss}</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">列印</button></div>
${page1(patient, episode, activePrescriptions, diagnosisRecords, contacts, advanceDirectiveTasks, settings)}
${page2(patient, mealGuidance, tubeCareRecord, restraintAssessment, settings)}
</body>
</html>`;
};

export const printPatientReferralForm = async (
  patient: Patient,
  episode: HospitalEpisode,
  mealGuidance?: MealGuidance
): Promise<void> => {
  const settings = await getFacilitySettings();

  // 取得現時在服處方
  const prescriptions = await getPrescriptions(patient.院友id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activePrescriptions = prescriptions.filter(p => {
    if (p.status !== 'active') return false;
    const start = p.start_date ? new Date(p.start_date) : null;
    if (start && start > today) return false;
    const end = p.end_date ? new Date(p.end_date) : null;
    if (end && end < today) return false;
    return true;
  });

  // 取得鼻胃飼管更換記錄
  const tubeCareRecords = await getTubeCareRecords();
  const ngTubeRecord = tubeCareRecords
    .filter(r => r.patient_id === patient.院友id && r.care_type === '鼻胃飼管更換')
    .sort((a, b) => new Date(b.execution_date).getTime() - new Date(a.execution_date).getTime())[0];

  // 取得診斷記錄
  const diagnosisRecords = await getDiagnosisRecordsByPatientId(patient.院友id);

  // 取得聯絡人
  const contacts = await getPatientContacts(patient.院友id);

  // 取得預設醫療指示（預設醫療指示）任務
  const allHealthTasks = await getHealthTasks();
  const advanceDirectiveTasks = allHealthTasks
    .filter(t => t.patient_id === patient.院友id && t.health_record_type === '預設醫療指示')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 取得最新的約束物品評估
  const restraintAssessments = await getRestraintAssessments();
  const latestRestraintAssessment = restraintAssessments
    .filter(a => a.patient_id === patient.院友id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const html = generatePatientReferralHtml(
    patient,
    episode,
    activePrescriptions,
    diagnosisRecords,
    contacts,
    advanceDirectiveTasks,
    {
      facilityNameZh: settings.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh,
      facilityNameEn: settings.facilityNameEn || '',
      facilityAddressZh: settings.facilityAddressZh || '',
      facilityAddressEn: settings.facilityAddressEn || '',
      facilityPhone: settings.facilityPhone || '',
      facilityFax: settings.facilityFax || '',
    },
    mealGuidance,
    ngTubeRecord,
    latestRestraintAssessment
  );

  const old = document.getElementById('patient-referral-print-iframe');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'patient-referral-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.top = '-1000px';
  iframe.style.left = '-1000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    throw new Error('無法建立列印文件');
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    const onLoad = () => {
      iframe.removeEventListener('load', onLoad);
      resolve();
    };
    iframe.addEventListener('load', onLoad);
    if (doc.readyState === 'complete') {
      onLoad();
    }
  });

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
};

export const printPatientReferralForms = async (
  episodes: HospitalEpisode[],
  patients: Patient[],
  mealGuidances?: MealGuidance[]
): Promise<void> => {
  let allMealGuidances = mealGuidances;
  if (!allMealGuidances) {
    allMealGuidances = await getMealGuidances();
  }

  for (const episode of episodes) {
    const patient = patients.find(p => p.院友id === episode.patient_id);
    if (!patient) continue;

    const mealGuidance = allMealGuidances.find(m => m.patient_id === episode.patient_id);
    await printPatientReferralForm(patient, episode, mealGuidance);
  }
};

