import doctorVisitTemplate from '../../../../../upload/doc_html/醫生診治記錄.html?raw';
import { processDocHtmlTemplate, combineDocHtmlDocuments } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateDoctorVisitHtml(ctx: DocumentGeneratorContext): Promise<string> {
  const page = processDocHtmlTemplate(doctorVisitTemplate, ctx);
  // 雙面文件：正面/背面印同一內容
  return Promise.resolve(combineDocHtmlDocuments([page, page]));
}
