// 生命表徵觀察記錄表打孔虛線預覽：bundle 真 generator + 假資料 → 寫出預覽 HTML
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');

const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: path.join(stubDir, 'supabase-bp.ts') }));
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
  },
};

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/bloodPressureRecordWorksheetGenerator.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { generateBloodPressureRecordHtml } = mod.exports;

  const html = await generateBloodPressureRecordHtml('2026-09-01', '2026-09-30', [1, 2], { includeData: true });

  // 預覽用 screen-only 樣式：紙面白底 + 左邊留位顯示打孔區（列印時完全無影響）
  const previewCss = `<style>
@media screen {
  body { background: #d0d0d0 !important; padding: 10mm 0 10mm 20mm; }
  .container { background: #fff; box-shadow: 0 0 4mm rgba(0,0,0,.4); margin-bottom: 10mm; }
}
</style>`;
  const out = html.replace(/<\/head>/i, `${previewCss}</head>`);
  const outPath = path.join(root, 'scripts/previews/blood_pressure_punch_preview.html');
  fs.writeFileSync(outPath, out, 'utf8');
  console.log('written:', outPath);
  console.log('pages:', (out.match(/class="container"/g) || []).length);
})();
