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

// case A: 單一 style 帶 @page（對照組，應該 work）
const caseA = `<html><head><style>@page { size: A4; margin: 5mm 6.35mm 5mm 0; }</style></head><body>x</body></html>`;
console.log('A single style:', JSON.stringify(printUtils.extractPageConfig(caseA)));

// case B: 兩個 style，第一個冇 @page
const caseB = `<html><head><style>body { padding-left: 20mm; }</style><style>@page { size: A4; margin: 5mm 6.35mm 5mm 0; }</style></head><body>x</body></html>`;
console.log('B two styles:', JSON.stringify(printUtils.extractPageConfig(caseB)));

// case C: style 喺 body 內（模擬 nested doc 結構）
const caseC = `<html><head><title>t</title></head><body><style>@page { size: A4; margin: 5mm 6.35mm 5mm 0; }</style><div>x</div></body></html>`;
console.log('C style in body:', JSON.stringify(printUtils.extractPageConfig(caseC)));

// case D: @page 跨行（同真實文件一樣）
const caseD = `<html><head><style>
    @page {
      size: A4;
      margin: 5mm 6.35mm 5mm 0;
    }
</style></head><body>x</body></html>`;
console.log('D multiline:', JSON.stringify(printUtils.extractPageConfig(caseD)));

// case E: 前面有個 punch-guide 風格 style（含 body 規則 + 註釋）
const caseE = `<html><head><style>
  body { padding-left: 20mm; overflow-x: clip; }
  /* 固定 210mm 闊嘅滿版容器（託管書/健康記錄等，可能嵌套喺 doc-page 入面）：
     內容盒讓位 20mm 後自動縮闊，右邊維持貼紙邊，唔會再被裁走右邊文字 */
  body > *, body .a4-container { max-width: 100%; }
  .punch-guide-fixed { position: fixed; pointer-events: none; z-index: 2147483646; }
</style></head><body><div class="punch-guide-fixed"></div>
<style>
    @page {
      size: A4;
      margin: 5mm 6.35mm 5mm 0;
    }
    body { margin: 0; }
</style>
<div class="page">x</div></body></html>`;
console.log('E punch+body-style:', JSON.stringify(printUtils.extractPageConfig(caseE)));
