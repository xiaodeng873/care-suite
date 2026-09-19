import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = { name: 'stubs', setup(b) {
  b.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
  b.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
}};
const bundle = async (file) => {
  const r = await esbuild.build({ entryPoints: [path.join(root, file)], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [stubPlugin] });
  return await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const nursing = await bundle('apps/web/src/utils/patientLogNursingTreatmentGenerator.ts');
const printPageLogo = await bundle('apps/web/src/utils/printPageLogo.ts');
const dummyPatient = { 院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友', 床號: 'A103-2', 性別: '女', 出生日期: '1929-01-01', 在住狀態: '在住' };
const blankLog = { id: 'blank', patient_id: 999, log_date: '', log_type: '其他', content: '', recorder: '' };
const html = await nursing.generatePatientLogNursingTreatmentHtml([blankLog], [dummyPatient], ['blank']);
console.log('===== generator 原始輸出（頭 1500 字元）=====');
console.log(html.slice(0, 1500));
console.log('\n===== 所有 <style> 標籤內的 @page =====');
const styles = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
styles.forEach((s, i) => {
  const pages = s.match(/@page[^{]*\{[^}]*\}/g);
  console.log(`style[${i}]:`, pages ? pages.join(' | ') : '(no @page)');
});
const logoHtml = printPageLogo.injectPageLogo(html, 'data:image/png;base64,x');
console.log('\n===== injectPageLogo 後：所有 @page =====');
const pages2 = logoHtml.match(/@page[^{]*\{[^}]*\}/g);
console.log(pages2 ? pages2.join('\n') : '(none)');
console.log('\n===== injectPageLogo 後：head 區域 =====');
console.log(logoHtml.slice(0, logoHtml.indexOf('</head>') + 7));
