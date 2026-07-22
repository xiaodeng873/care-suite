import nursingAssessmentTemplate from '../../../../../doc_html/院友護理評估記錄.html?raw';
import { processDocHtmlTemplate } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateNursingAssessmentHtml(ctx: DocumentGeneratorContext): Promise<string> {
  const { patient } = ctx;

  const checkedBoxes: string[] = [];
  if (patient.性別 === '男') checkedBoxes.push('gender_male');
  if (patient.性別 === '女') checkedBoxes.push('gender_female');

  return Promise.resolve(processDocHtmlTemplate(nursingAssessmentTemplate, ctx, {
    fieldValues: {
      bed_no: patient.床號 || '',
      birth_date: patient.出生日期 || '',
      admission_date: patient.入住日期 || '',
    },
    checkedBoxes,
  }));
}
