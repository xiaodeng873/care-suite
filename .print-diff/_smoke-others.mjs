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
const printUtils = await bundle('apps/web/src/utils/printUtils.ts');
const nursing = await bundle('apps/web/src/utils/patientLogNursingTreatmentGenerator.ts');
const dummyPatient = { 院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試院友', 床號: 'A103-2', 性別: '女', 出生日期: '1929-01-01', 在住狀態: '在住' };

// 真實 nursing 輸出（punchGuide 後）
const blankLog = { id: 'b', patient_id: 999, log_date: '', log_type: '其他', content: '', recorder: '' };
const nursingHtml = await nursing.generatePatientLogNursingTreatmentHtml([blankLog], [dummyPatient], ['b']);
console.log('nursing:', JSON.stringify(printUtils.extractPageConfig(nursingHtml)));

// 多院友：每個院友一組 .page，單一文件
const p2 = { ...dummyPatient, 院友id: 998, 中文名字: '第二友' };
const log2 = { ...blankLog, id: 'b2', patient_id: 998 };
const multi = await nursing.generatePatientLogNursingTreatmentHtml([blankLog, log2], [dummyPatient, p2], ['b', 'b2']);
const pageCount = (multi.match(/class="page"/g) || []).length;
console.log('multi-patient .page count:', pageCount, '(expect 2)');

// 醫生診治記錄（最近改過 @page 的文件）
const fs = await import('fs');
const dvPath = path.join(root, 'upload/doc_html/醫生診治記錄.html');
if (fs.existsSync(dvPath)) {
  const dv = fs.readFileSync(dvPath, 'utf-8');
  console.log('醫生診治記錄.html:', JSON.stringify(printUtils.extractPageConfig(dv)));
}
