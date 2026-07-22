import doctorVisitTemplate from '../../../../../doc_html/醫生診治記錄.html?raw';
import { processDocHtmlTemplate } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateDoctorVisitHtml(ctx: DocumentGeneratorContext): Promise<string> {
  return Promise.resolve(processDocHtmlTemplate(doctorVisitTemplate, ctx));
}
