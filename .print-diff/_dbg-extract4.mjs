import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import fs from 'fs';
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
const blankLog = { id: 'blank', patient_id: 999, log_date: '', log_type: '其他', content: '', recorder: '' };
const html = await nursing.generatePatientLogNursingTreatmentHtml([blankLog], [dummyPatient], ['blank']);
fs.writeFileSync(path.join(__dirname, '_nursing-raw.html'), html);
const cfg = (h) => printUtils.extractPageConfig(h).margin;
console.log('raw:', JSON.stringify(cfg(html)));

// 實驗 1：抽出所有 style 內容 join（同 extractPageConfig 內部一致），再手工搵 @page
const tags = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
console.log('style tag count:', tags.length);
const joined = tags.map((t) => t.replace(/<\/?style[^>]*>/gi, '')).join('\n');
const noComments = joined.replace(/\/\*[\s\S]*?\*\//g, '');
const idx = noComments.search(/@page(?:\s+[\w-]+)?\s*\{/i);
console.log('idx of @page in joined-css:', idx);
console.log('context around idx:', JSON.stringify(noComments.slice(Math.max(0, idx - 80), idx + 120)));
