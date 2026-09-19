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
const cfg = (h) => JSON.stringify(printUtils.extractPageConfig(h).margin);

// E1: B + 第一個 style 加註釋
const E1 = `<html><head><style>body { padding-left: 20mm; } /* 註釋：滿版容器（託管書）讓位 */</style><style>@page { size: A4; margin: 5mm 6.35mm 5mm 0; }</style></head><body>x</body></html>`;
console.log('E1 comment in s0:', cfg(E1));

// E2: B + 第二個 style 搬到 body
const E2 = `<html><head><style>body { padding-left: 20mm; }</style></head><body><style>@page { size: A4; margin: 5mm 6.35mm 5mm 0; }</style><div>x</div></body></html>`;
console.log('E2 s1 in body:', cfg(E2));

// E3: 第二個 style 加 body 規則
const E3 = `<html><head><style>body { padding-left: 20mm; }</style><style>@page { size: A4; margin: 5mm 6.35mm 5mm 0; } body { margin: 0; }</style></head><body>x</body></html>`;
console.log('E3 body rule after @page:', cfg(E3));

// E4: 第一個 style 含 * 選擇器
const E4 = `<html><head><style>body > * { max-width: 100%; }</style><style>@page { size: A4; margin: 5mm 6.35mm 5mm 0; }</style></head><body>x</body></html>`;
console.log('E4 star selector:', cfg(E4));

// E5: 多行 @page + body 規則（同 E 的 style[1] 完全一樣）
const E5 = `<html><head><style>body { padding-left: 20mm; }</style></head><body>
<style>
    @page {
      size: A4;
      margin: 5mm 6.35mm 5mm 0;
    }
    body { margin: 0; }
</style>
<div>x</div></body></html>`;
console.log('E5 multiline @page in body:', cfg(E5));
