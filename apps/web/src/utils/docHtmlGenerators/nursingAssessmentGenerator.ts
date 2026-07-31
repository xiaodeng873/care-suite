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

  // 將 nursing_assessment_json 內的布林值與文字值對應到範本欄位
  Object.entries(nursing).forEach(([key, value]) => {
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
