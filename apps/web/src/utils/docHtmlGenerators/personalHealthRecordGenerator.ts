import personalHealthRecordP1 from '../../../../../upload/doc_html/院友個人及健康記錄P1.html?raw';
import personalHealthRecordP2 from '../../../../../upload/doc_html/院友個人及健康記錄P2.html?raw';
import { processDocHtmlTemplate, combineDocHtmlDocuments } from './baseTemplateProcessor';
import { getPrintBedNumber } from '../../utils/bedTransferUtils';
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

export async function generatePersonalHealthRecordHtml(ctx: DocumentGeneratorContext): Promise<string> {
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

  // ── 緊急聯絡人映射：第一聯絡人必為保證人；第二、三優先緊急聯絡人；最多三個 ──
  if (ctx.contentMode !== 'blank') {
    const db = await import('../../lib/database');
    const contacts = await db.getPatientContacts(patient.院友id).catch(() => []);
    const purposesOf = (c: (typeof contacts)[number]) => c.purposes || [];
    // 舊資料無 purposes 時，以關係文字 / 舊 is_primary 欄位推斷身份
    const isGuarantor = (c: (typeof contacts)[number]) =>
      purposesOf(c).some(p => p.includes('保證人')) ||
      (purposesOf(c).length === 0 && ((c.關係 || '').includes('保證人') || c.is_primary));
    const isEmergency = (c: (typeof contacts)[number]) =>
      purposesOf(c).includes('緊急聯絡人') || (c.關係 || '').includes('緊急');

    const picked: (typeof contacts)[number][] = [];
    const take = (pool: typeof contacts) => {
      const c = pool.find(x => !picked.includes(x));
      if (c) picked.push(c);
    };
    take(contacts.filter(isGuarantor));      // 第一聯絡人：保證人
    if (picked.length === 0) take(contacts); // 無保證人時以首個聯絡人頂上
    take(contacts.filter(isEmergency));      // 第二：優先緊急聯絡人，否則任取
    take(contacts);
    take(contacts.filter(isEmergency));      // 第三：優先緊急聯絡人，否則任取
    take(contacts);

    picked.slice(0, 3).forEach((c, i) => {
      const n = i + 1;
      p1FieldValues[`c${n}_name_id`] = [c.聯絡人姓名, c.身份證號碼].filter(Boolean).join('\n');
      p1FieldValues[`c${n}_relation`] = c.關係 || '';
      p1FieldValues[`c${n}_contact_detail`] = [c.聯絡電話, c.電郵, c.地址].filter(Boolean).join('\n');
      p1FieldValues[`c${n}_remark`] = c.備註 || '';
    });
    // 「第一聯絡人」checkbox 只標記放喺第一格嗰位
    if (picked.length > 0) p1Checked.push('c1_is_emergency');
  }

  // ── P2：表頭基本資料 ────────────────────────────────────────────────────
  // （首次記錄職員/修訂記錄屬職員手填欄位，留白）
  const allergies = patient.藥物敏感 || [];
  const p2FieldValues: Record<string, string> = {
    m_resident_name: chineseName,
    m_room_no: getPrintBedNumber(patient) || '',
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
