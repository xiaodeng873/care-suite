import medicationProxyTemplate from '../../../../../upload/doc_html/要求院舍派發成藥確認書.html?raw';
import { processDocHtmlTemplate, setInputTagValue } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateMedicationProxyHtml(ctx: DocumentGeneratorContext): Promise<string> {
  let html = processDocHtmlTemplate(medicationProxyTemplate, ctx);
  if (ctx.contentMode !== 'blank') {
    const { patient } = ctx;
    const name = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
    // 「___ （住客姓名）的」— input 在標籤之前
    html = html.replace(
      /(<input(?![^>]*checkbox)[^>]*>)(\s*（住客姓名）)/i,
      (_m, tag: string, post: string) => setInputTagValue(tag, name) + post
    );
  }
  return Promise.resolve(html);
}
