import orientationPlanTemplate from '../../../../../upload/doc_html/新院友入住導向計劃紀錄.html?raw';
import { processDocHtmlTemplate } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateOrientationPlanHtml(ctx: DocumentGeneratorContext): Promise<string> {
  return Promise.resolve(processDocHtmlTemplate(orientationPlanTemplate, ctx));
}
