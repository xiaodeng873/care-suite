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

// 簡化版 html：兩個 style 標籤，第二個先有 @page
const html = `<!DOCTYPE html><html><head><title>t</title>
<style>
  body { padding-left: 20mm; overflow-x: clip; }
  /* comment with @page { margin: 0 } inside? no */
  body > * { max-width: 100%; }
</style></head>
<body><div>x</div>
<style>
    @page {
      size: A4;
      margin: 5mm 6.35mm 5mm 0;
    }
</style>
</body></html>`;
console.log('config:', JSON.stringify(printUtils.extractPageConfig(html)));

// 逐個 style 標籤內容
const tags = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
tags.forEach((t, i) => console.log(`style[${i}] has @page:`, /@page/i.test(t)));
