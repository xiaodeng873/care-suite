import personalHealthRecordP1 from '../../../../../doc_html/院友個人及健康記錄P1.html?raw';
import personalHealthRecordP2 from '../../../../../doc_html/院友個人及健康記錄P2.html?raw';
import { processDocHtmlTemplate, combineDocHtmlDocuments } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

const EDUCATION_CHECKBOX: Record<string, string> = {
  '未受教育': 'edu_none',
  '未受教育,但可閱報': 'edu_read',
  '未受教育，但可閱報': 'edu_read',
  '小學': 'edu_primary',
  '中學': 'edu_secondary',
  '大學': 'edu_university',
};

const MARITAL_CHECKBOX: Record<string, string> = {
  '單身': 'marry_single',
  '已婚': 'marry_married',
  '分居': 'marry_separated',
  '離婚': 'marry_divorced',
  '鰥寡': 'marry_widowed',
};

const RELIGION_CHECKBOX: Record<string, string> = {
  '天主教': 'rel_catholic',
  '基督教': 'rel_christian',
  '佛教': 'rel_buddhism',
  '回教': 'rel_islam',
};

export function generatePersonalHealthRecordHtml(ctx: DocumentGeneratorContext): Promise<string> {
  const { patient } = ctx;
  const chineseName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const englishName = patient.英文姓名 || `${patient.英文姓氏 || ''}${patient.英文名字 || ''}`;

  // ── P1：基本資料 + 社交狀況 ──────────────────────────────────────────────
  const p1FieldValues: Record<string, string> = {
    p_name_ch: chineseName,
    p_name_en: englishName,
    p_birth: patient.出生日期 || '',
    p_id_no: patient.身份證號碼 || '',
    p_admission_date: patient.入住日期 || '',
    p_leave_date: patient.退住日期 || '',
    p_phone: patient.通訊電話 || '',
    p_address: patient.通訊地址 || '',
    prev_occupation: patient.從前主要職業 || '',
  };

  const p1Checked: string[] = [];
  if (patient.性別 === '男') p1Checked.push('p_sex_m');
  if (patient.性別 === '女') p1Checked.push('p_sex_f');
  if (patient.教育程度 && EDUCATION_CHECKBOX[patient.教育程度]) p1Checked.push(EDUCATION_CHECKBOX[patient.教育程度]);
  if (patient.婚姻狀況 && MARITAL_CHECKBOX[patient.婚姻狀況]) p1Checked.push(MARITAL_CHECKBOX[patient.婚姻狀況]);
  if (patient.宗教信仰 && RELIGION_CHECKBOX[patient.宗教信仰]) p1Checked.push(RELIGION_CHECKBOX[patient.宗教信仰]);
  if (patient.discharge_reason === '轉往其他機構') p1Checked.push('leave_reason_transfer');
  if (patient.discharge_reason === '死亡') p1Checked.push('leave_reason_death');

  // ── P2：表頭基本資料 ────────────────────────────────────────────────────
  // （首次記錄職員/修訂記錄屬職員手填欄位，留白）
  const allergies = patient.藥物敏感 || [];
  const p2FieldValues: Record<string, string> = {
    m_resident_name: chineseName,
    m_room_no: patient.床號 || '',
    m_id_no: patient.身份證號碼 || '',
    allergy_detail: allergies.join('、'),
  };

  const p2Checked: string[] = [];
  if (allergies.length > 0) p2Checked.push('hist_allergy');

  const p1 = processDocHtmlTemplate(personalHealthRecordP1, ctx, {
    fieldValues: p1FieldValues,
    checkedBoxes: p1Checked,
  });
  const p2 = processDocHtmlTemplate(personalHealthRecordP2, ctx, {
    fieldValues: p2FieldValues,
    checkedBoxes: p2Checked,
  });
  return Promise.resolve(combineDocHtmlDocuments([p1, p2]));
}
