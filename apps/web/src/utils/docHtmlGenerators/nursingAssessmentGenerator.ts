import nursingAssessmentTemplate from '../../../../../upload/doc_html/院友護理評估記錄.html?raw';
import { processDocHtmlTemplate } from './baseTemplateProcessor';
import { getPrintBedNumber } from '../../utils/bedTransferUtils';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateNursingAssessmentHtml(ctx: DocumentGeneratorContext): Promise<string> {
  const { patient } = ctx;
  const nursing = patient.nursing_assessment_json || {};

  const checkedBoxes: string[] = [];
  if (patient.性別 === '男') checkedBoxes.push('gender_male');
  if (patient.性別 === '女') checkedBoxes.push('gender_female');

  const fieldValues: Record<string, string> = {
    bed_no: getPrintBedNumber(patient) || '',
    birth_date: patient.出生日期 || '',
    admission_date: patient.入住日期 || '',
  };

  // 將 nursing_assessment_json 內的布林值與文字值對應到範本欄位。
  // 評估員資料（assessor_*）唔再映射——打印留白，職員手填。
  const ASSESSOR_FIELDS = new Set(['assessor_name', 'assessor_rank', 'assessor_sign', 'assess_date']);
  Object.entries(nursing).forEach(([key, value]) => {
    if (ASSESSOR_FIELDS.has(key)) return;
    if (value === true) {
      checkedBoxes.push(key);
    } else if (typeof value === 'string') {
      fieldValues[key] = value;
    }
  });

  return Promise.resolve(processDocHtmlTemplate(nursingAssessmentTemplate, ctx, {
    fieldValues,
    checkedBoxes,
  }));
}
