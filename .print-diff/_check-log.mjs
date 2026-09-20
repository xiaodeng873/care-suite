import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const r = await esbuild.build({
  entryPoints: [path.join(root, 'apps/web/src/utils/prescriptionActivityLog.ts')],
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 's', setup(b) {
    b.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
    b.onResolve({ filter: /lib\/database/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
  }}],
});
const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const rule = { vital_sign_type: '血糖值', condition_operator: 'lte', condition_value: 4, action_if_met: 'warning_only' };
const oldP = { medication_name: 'A', inspection_rules: [] };
const newP = { medication_name: 'A', inspection_rules: [rule] };
console.log('新增檢測項:', JSON.stringify(m.diffPrescriptions(oldP, newP), null, 1));
const modP = { medication_name: 'A', inspection_rules: [{ ...rule, condition_value: 5 }] };
console.log('修改檢測值:', JSON.stringify(m.diffPrescriptions(newP, modP).map(c => `${c.label}: ${c.old} → ${c.new}`)));
console.log('無變更:', JSON.stringify(m.diffPrescriptions(newP, { ...newP })));
console.log('空陣列 vs undefined:', JSON.stringify(m.diffPrescriptions({ medication_name: 'A' }, { medication_name: 'A', inspection_rules: [] })));
